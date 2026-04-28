// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { act, renderHook, waitFor } from "@testing-library/react"
import { CardPickerProvider } from "./CardPickerProvider.js"
import { useCardPicker } from "./useCardPicker.js"
import type { ReactNode } from "react"

const defaultOption = { id: "scryfall:abc", sourceName: "Scryfall", cardName: "Sol Ring", imageUrl: "https://x/sol.png", meta: {} }
const moreOptions = [
  { ok: true, source: "Scryfall", options: [defaultOption] },
  { ok: true, source: "MPC Fill", options: [{ id: "mpcfill:xyz", sourceName: "MPC Fill", cardName: "Sol Ring", imageUrl: "https://x/sol-mpc.png", meta: {} }] },
]

const server = setupServer(
  http.get("http://localhost/api/cardartpicker/default", ({ request }) => {
    const u = new URL(request.url)
    if (u.searchParams.get("name") === "Sol Ring") return HttpResponse.json(defaultOption)
    return HttpResponse.json({ error: "not-found" }, { status: 404 })
  }),
  http.get("http://localhost/api/cardartpicker/options", () => HttpResponse.json(moreOptions)),
  http.post("http://localhost/api/cardartpicker/parse", () =>
    HttpResponse.json({ mainboard: [{ quantity: 1, name: "Sol Ring", type: "card" }], tokens: [], warnings: [] })),
)

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const wrap = ({ children }: { children: ReactNode }) => (
  <CardPickerProvider apiBase="/api/cardartpicker">{children}</CardPickerProvider>
)

describe("useCardPicker", () => {
  it("parses list and creates slots with default prints", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]!
    expect(slot.cardName).toBe("Sol Ring")
    expect(slot.selectedOptionId).toBe("scryfall:abc")
  })

  it("background-loads all options after defaults", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]!
    await waitFor(() => expect(result.current.getSlot(slot.id)!.options.length).toBeGreaterThan(1))
    await waitFor(() => expect(result.current.optionsProgress).toBeNull())
  })

  it("cycleOption rotates through filled options", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]!
    await waitFor(() => expect(result.current.getSlot(slot.id)!.options.length).toBeGreaterThan(1))
    const before = result.current.getSlot(slot.id)!.selectedOptionId
    await act(() => result.current.cycleOption(slot.id, "next"))
    expect(result.current.getSlot(slot.id)!.selectedOptionId).not.toBe(before)
  })

  it("selectOption updates selections map", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]!
    await act(() => result.current.cycleOption(slot.id, "next"))
    await waitFor(() => expect(result.current.getSlot(slot.id)!.options.length).toBeGreaterThan(1))
    await act(() => result.current.selectOption(slot.id, "mpcfill:xyz"))
    expect(result.current.selections[slot.id]).toBe("mpcfill:xyz")
  })

  it("flipSlot toggles front/back without changing selection", async () => {
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("1 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(1))
    const slot = result.current.list.mainboard[0]!
    const before = result.current.selections[slot.id]
    await act(() => result.current.flipSlot(slot.id))
    expect(result.current.getSlot(slot.id)!.flipped).toBe(true)
    expect(result.current.selections[slot.id]).toBe(before)
  })

  it("expands quantity into multiple slots", async () => {
    server.use(http.post("http://localhost/api/cardartpicker/parse", () =>
      HttpResponse.json({ mainboard: [{ quantity: 3, name: "Sol Ring", type: "card" }], tokens: [], warnings: [] })))
    const { result } = renderHook(() => useCardPicker(), { wrapper: wrap })
    await act(() => result.current.parseList("3 Sol Ring"))
    await waitFor(() => expect(result.current.list.mainboard).toHaveLength(3))
  })
})
