"use client"

import { useCardPicker } from "cardartpicker/client"

export function OrderSummary() {
  const { list, download } = useCardPicker()
  const count = list.mainboard.length + list.tokens.length
  return (
    <aside style={{ padding: "1rem", background: "var(--cap-slot-bg)", borderRadius: 8, position: "sticky", top: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Order Summary</h3>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Mainboard</span><span>{list.mainboard.length}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tokens</span><span>{list.tokens.length}</span></div>
      <hr style={{ borderColor: "var(--cap-border)" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>$0</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--cap-muted)", fontSize: "0.85rem" }}>
        <span>Shipping</span><span>free*</span>
      </div>
      <button
        onClick={() => void download()}
        disabled={count === 0}
        style={{ width: "100%", padding: "0.6rem", marginTop: "1rem", background: "var(--cap-accent)", color: "#111", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
      >
        Checkout
      </button>
      <p style={{ fontSize: "0.7rem", color: "var(--cap-muted)" }}>*demo — triggers download</p>
    </aside>
  )
}
