"use client"

import { useCardPicker } from "cardartpicker/client"

export function ShopHeader() {
  return (
    <header className="relative z-20 border-b border-edge">
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brass/60 to-transparent" />
      <div className="mx-auto max-w-[1600px] flex items-center px-8 py-5 gap-10">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="text-2xl text-brass">⛧</span>
          <strong className="font-display text-2xl tracking-[0.3em] uppercase text-bone">
            Proxy<span className="text-brass">Mart</span>
          </strong>
          <span className="hidden sm:inline-block ml-1 px-1.5 py-0.5 border border-edge font-mono text-[0.55rem] uppercase tracking-[0.25em] text-muted">
            est · mmxxvi
          </span>
        </div>
        <nav className="hidden md:flex gap-6 font-mono text-[0.7rem] uppercase tracking-[0.3em] text-muted">
          <a className="hover:text-brass transition-colors" href="#">decks</a>
          <a className="hover:text-brass transition-colors" href="#">sets</a>
          <a className="hover:text-brass transition-colors" href="#">tokens</a>
          <a className="hover:text-brass transition-colors" href="#">about</a>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden md:inline font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted">
            free shipping over $0
          </span>
          <CartBadge />
        </div>
      </div>
    </header>
  )
}

function CartBadge() {
  const { selections } = useCardPicker()
  const count = Object.keys(selections).length
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-brass/60 bg-brass/5 text-brass font-mono text-[0.7rem] uppercase tracking-[0.25em]">
      <span aria-hidden>◈</span>
      <span>cart</span>
      <span className="text-bone">{String(count).padStart(2, "0")}</span>
    </span>
  )
}
