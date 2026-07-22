// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react"
import { useEffect, useRef } from "react"
import { CardPickerProvider, useCardPicker } from "../client/index.js"
import { OptionsModal } from "./OptionsModal.js"

const defaultOption = { id: "scryfall:abc", sourceName: "Scryfall", cardName: "Sol Ring", imageUrl: "https://x/sol.png", meta: {} }
const moreOptions = [
  { ok: true, source: "Scryfall", options: [defaultOption], total: 1, hasMore: false },
  { ok: true, source: "MPC Fill", options: [{ id: "mpcfill:xyz", sourceName: "MPC Fill", cardName: "Sol Ring", imageUrl: "https://x/sol-mpc.png", meta: {} }], total: 1, hasMore: false },
]

let optionsRequests = 0

const printOption = (set: string, i: number) => ({
  id: `scryfall:${set.toLowerCase()}-${i}`,
  sourceName: "Scryfall",
  cardName: "Sol Ring",
  imageUrl: `https://x/${set.toLowerCase()}-${i}.png`,
  meta: { setCode: set },
})

const pagedPrints = (all: ReturnType<typeof printOption>[]) =>
  http.get("http://localhost/api/cardartpicker/options", ({ request }) => {
    optionsRequests++
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0)
    const slice = all.slice(offset, offset + 100)
    return HttpResponse.json([
      { ok: true, source: "Scryfall", options: slice, total: all.length, hasMore: offset + slice.length < all.length },
    ])
  })

const server = setupServer(
  http.post("http://localhost/api/cardartpicker/parse", () =>
    HttpResponse.json({ mainboard: [{ quantity: 1, name: "Sol Ring", type: "card" }], tokens: [], warnings: [] })),
  http.post("http://localhost/api/cardartpicker/defaults", () =>
    HttpResponse.json({ "card:sol ring": defaultOption })),
  http.get("http://localhost/api/cardartpicker/options", () => {
    optionsRequests++
    return HttpResponse.json(moreOptions)
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => { cleanup(); server.resetHandlers(); optionsRequests = 0 })
afterAll(() => server.close())

function ModalHarness() {
  const picker = useCardPicker()
  const kicked = useRef(false)
  useEffect(() => {
    if (!kicked.current) {
      kicked.current = true
      void picker.parseList("1 Sol Ring")
    }
  }, [picker])
  const first = picker.list.mainboard[0]
  if (!first || first.status !== "ready") return null
  return <OptionsModal slotId={first.id} onClose={() => {}} />
}

describe("OptionsModal", () => {
  it("auto-loads full options when opened on an unexpanded slot", async () => {
    render(
      <CardPickerProvider apiBase="/api/cardartpicker">
        <ModalHarness />
      </CardPickerProvider>
    )
    await waitFor(() => expect(screen.queryByText(/choose print/i)).toBeTruthy())
    await waitFor(() => expect(optionsRequests).toBe(1))
    await waitFor(() => expect(screen.getByText(/2 options/i)).toBeTruthy())
  })

  it("never renders a 'load 0 more' button", async () => {
    render(
      <CardPickerProvider apiBase="/api/cardartpicker">
        <ModalHarness />
      </CardPickerProvider>
    )
    await waitFor(() => expect(screen.queryByText(/choose print/i)).toBeTruthy())
    expect(screen.queryByText(/load 0 more/i)).toBeNull()
    await waitFor(() => expect(screen.getByText(/2 options/i)).toBeTruthy())
    expect(screen.queryByText(/load 0 more/i)).toBeNull()
  })
})

describe("OptionsModal filter", () => {
  it("narrows the grid to options matching the set code and updates the count", async () => {
    server.use(pagedPrints([printOption("LEA", 0), printOption("SLD", 1)]))
    render(
      <CardPickerProvider apiBase="/api/cardartpicker">
        <ModalHarness />
      </CardPickerProvider>
    )
    await waitFor(() => expect(screen.getByText("LEA")).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: "sld" } })
    await waitFor(() => expect(screen.queryByText("LEA")).toBeNull())
    expect(screen.getByText("SLD")).toBeTruthy()
    expect(screen.getByText(/1 matches \/ 2 options/i)).toBeTruthy()
  })

  it("sweeps remaining pages while a filter is active", async () => {
    const all = [
      ...Array.from({ length: 100 }, (_, i) => printOption("LEA", i)),
      ...Array.from({ length: 20 }, (_, i) => printOption("SLD", 100 + i)),
    ]
    server.use(pagedPrints(all))
    render(
      <CardPickerProvider apiBase="/api/cardartpicker">
        <ModalHarness />
      </CardPickerProvider>
    )
    // initial auto-load fetches page 0 only (100 LEA prints, hasMore true)
    await waitFor(() => expect(optionsRequests).toBe(1))
    expect(screen.queryByText("SLD")).toBeNull()
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: "sld" } })
    // filter triggers the sweep for page 1; SLD prints appear
    await waitFor(() => expect(optionsRequests).toBe(2))
    await waitFor(() => expect(screen.getAllByText("SLD")).toHaveLength(20))
    expect(screen.getByText(/20 matches \/ 120 options/i)).toBeTruthy()
  })

  it("clearing the filter restores the full list", async () => {
    server.use(pagedPrints([printOption("LEA", 0), printOption("SLD", 1)]))
    render(
      <CardPickerProvider apiBase="/api/cardartpicker">
        <ModalHarness />
      </CardPickerProvider>
    )
    await waitFor(() => expect(screen.getByText("LEA")).toBeTruthy())
    const input = screen.getByPlaceholderText(/filter/i)
    fireEvent.change(input, { target: { value: "sld" } })
    await waitFor(() => expect(screen.queryByText("LEA")).toBeNull())
    fireEvent.change(input, { target: { value: "" } })
    await waitFor(() => expect(screen.getByText("LEA")).toBeTruthy())
    expect(screen.getByText("SLD")).toBeTruthy()
    expect(screen.getByText(/2 options/i)).toBeTruthy()
  })

  it("shows a no-match state naming the filter", async () => {
    server.use(pagedPrints([printOption("LEA", 0)]))
    render(
      <CardPickerProvider apiBase="/api/cardartpicker">
        <ModalHarness />
      </CardPickerProvider>
    )
    await waitFor(() => expect(screen.getByText("LEA")).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: "zzz" } })
    await waitFor(() => expect(screen.getByText(/no prints match "zzz"/i)).toBeTruthy())
  })
})
