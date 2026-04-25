"use client"

import { useCardPicker } from "cardartpicker/client"

export function ShopHeader() {
  return (
    <header style={{ display: "flex", alignItems: "center", padding: "1rem 2rem", borderBottom: "1px solid var(--cap-border)" }}>
      <strong style={{ fontSize: "1.3rem", color: "var(--cap-accent)" }}>🃏 ProxyMart</strong>
      <nav style={{ marginLeft: "2rem", display: "flex", gap: "1rem", color: "var(--cap-muted)" }}>
        <span>Decks</span><span>Sets</span><span>About</span>
      </nav>
      <CartBadge />
    </header>
  )
}

function CartBadge() {
  const { selections } = useCardPicker()
  const count = Object.keys(selections).length
  return (
    <span style={{ marginLeft: "auto", padding: "0.3rem 0.8rem", background: "var(--cap-accent)", color: "#111", borderRadius: 999, fontSize: "0.85rem" }}>
      🛒 {count}
    </span>
  )
}
