export function Footer() {
  return (
    <footer className="relative mt-20 border-t border-edge">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent" />
      <div className="mx-auto max-w-[1600px] px-8 py-8 grid gap-4 md:grid-cols-3 items-center font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted">
        <div>
          card data via{" "}
          <a className="text-brass hover:underline" href="https://scryfall.com" target="_blank" rel="noreferrer">scryfall</a>
        </div>
        <div className="text-center text-bone-dim">
          cardartpicker · personal use only
        </div>
        <div className="md:text-right">
          not affiliated with wizards of the coast
        </div>
      </div>
    </footer>
  )
}
