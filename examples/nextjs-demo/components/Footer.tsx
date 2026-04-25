export function Footer() {
  return (
    <footer className="relative mt-20 border-t border-edge">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent" />
      <div className="mx-auto max-w-[1600px] px-8 py-10 grid gap-6 md:grid-cols-3 items-center">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted">
          shipped from the workshop · no real cards harmed
        </div>
        <div className="text-center">
          <span aria-hidden className="text-brass text-xl">⛧</span>
          <span className="ml-3 font-display tracking-[0.3em] uppercase text-bone-dim">ProxyMart</span>
        </div>
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted md:text-right">
          packages / cardartpicker
        </div>
      </div>
    </footer>
  )
}
