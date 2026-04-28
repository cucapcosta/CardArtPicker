export function DemoHeader() {
  return (
    <header className="relative z-20 border-b border-edge">
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brass/60 to-transparent" />
      <div className="mx-auto max-w-[1600px] flex items-center px-8 py-5 gap-6">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="text-2xl text-brass">◆</span>
          <strong className="font-display text-2xl tracking-[0.3em] uppercase text-bone">
            card<span className="text-brass">art</span>picker
          </strong>
          <span className="hidden sm:inline-block ml-1 px-1.5 py-0.5 border border-edge font-mono text-[0.55rem] uppercase tracking-[0.25em] text-muted">
            demo
          </span>
        </div>
        <div className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.25em] text-muted hidden md:block">
          card data via{" "}
          <a className="text-brass hover:underline" href="https://scryfall.com" target="_blank" rel="noreferrer">
            scryfall
          </a>
        </div>
      </div>
    </header>
  )
}
