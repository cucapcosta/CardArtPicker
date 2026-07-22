// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { render, screen, waitFor } from "@testing-library/react"
import { useEffect, useRef } from "react"
import { CardPickerProvider, useCardPicker } from "../client/index.js"
import { OptionsModal } from "./OptionsModal.js"

const defaultOption = { id: "scryfall:abc", sourceName: "Scryfall", cardName: "Sol Ring", imageUrl: "https://x/sol.png", meta: {} }
const moreOptions = [
  { ok: true, source: "Scryfall", options: [defaultOption], total: 1, hasMore: false },
  { ok: true, source: "MPC Fill", options: [{ id: "mpcfill:xyz", sourceName: "MPC Fill", cardName: "Sol Ring", imageUrl: "https://x/sol-mpc.png", meta: {} }], total: 1, hasMore: false },
]

let optionsRequests = 0

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
afterEach(() => { server.resetHandlers(); optionsRequests = 0 })
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
