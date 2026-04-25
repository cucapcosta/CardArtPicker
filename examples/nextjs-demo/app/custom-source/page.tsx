import { CardArtPicker } from "cardartpicker/ui"
import { ShopHeader } from "@/components/ShopHeader"
import { OrderSummary } from "@/components/OrderSummary"
import { Footer } from "@/components/Footer"

export default function CustomSource() {
  return (
    <main style={{ padding: "2rem" }}>
      <CardArtPicker
        initialList="1 Sol Ring"
        apiBase="/api/cardartpicker"
        slots={{ header: <ShopHeader />, sidebar: <OrderSummary />, footer: <Footer /> }}
      />
      <p style={{ color: "var(--cap-muted)" }}>
        Showcases &quot;My Proxies&quot; local-folder source alongside Scryfall and MPC Fill.
      </p>
    </main>
  )
}
