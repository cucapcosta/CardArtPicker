"use client"

import { useCardPicker } from "cardartpicker/client"

export function OptionsModal({ slotId, onClose }: { slotId: string; onClose: () => void }) {
  const { getSlot, selectOption } = useCardPicker()
  const slot = getSlot(slotId)
  if (!slot) return null

  const grouped = new Map<string, typeof slot.options>()
  for (const o of slot.options) {
    const arr = grouped.get(o.sourceName) ?? []
    arr.push(o)
    grouped.set(o.sourceName, arr)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[1000] grid place-items-center bg-[var(--cap-bg)]/85 backdrop-blur-sm p-6"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ borderRadius: "var(--cap-radius)" }}
        className="w-[min(92vw,1400px)] max-h-[85vh] overflow-y-auto bg-[var(--cap-surface)] border border-[var(--cap-border)] shadow-2xl"
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--cap-border)] bg-[var(--cap-surface)]/95 backdrop-blur"
        >
          <div className="flex items-baseline gap-3">
            <span className="font-[family-name:var(--cap-font-mono)] text-[0.65rem] uppercase tracking-[0.25em] text-[var(--cap-muted)]">
              choose print
            </span>
            <h2 className="font-[family-name:var(--cap-font-display)] text-xl tracking-wide text-[var(--cap-fg)]">
              {slot.cardName}
            </h2>
            <span className="font-[family-name:var(--cap-font-mono)] text-[0.7rem] text-[var(--cap-accent-soft)]">
              {slot.options.length} options
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-[var(--cap-muted)] hover:text-[var(--cap-accent)] border border-transparent hover:border-[var(--cap-border)] transition-colors"
          >✕</button>
        </header>

        <div className="p-6 space-y-8">
          {[...grouped.entries()].map(([sourceName, opts]) => (
            <section key={sourceName}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-[family-name:var(--cap-font-display)] tracking-[0.2em] text-sm uppercase text-[var(--cap-accent)]">
                  {sourceName}
                </h3>
                <div className="flex-1 cap-divider" />
                <span className="font-[family-name:var(--cap-font-mono)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--cap-muted)]">
                  {opts.length}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                {opts.map(opt => {
                  const active = opt.id === slot.selectedOptionId
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { selectOption(slot.id, opt.id); onClose() }}
                      style={{ borderRadius: "var(--cap-radius)" }}
                      className={`group relative flex flex-col gap-2 text-left overflow-hidden bg-[var(--cap-bg-soft)] transition-all ${active ? "ring-2 ring-[var(--cap-accent)]" : "ring-1 ring-[var(--cap-border)] hover:ring-[var(--cap-accent)]/60"}`}
                    >
                      <img
                        src={opt.thumbnailUrl ?? opt.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full aspect-[63/88] object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="px-2 pb-2 flex items-center gap-2 font-[family-name:var(--cap-font-mono)] text-[0.6rem] uppercase tracking-[0.18em]">
                        {opt.meta.setCode && (
                          <span className="px-1.5 py-0.5 bg-[var(--cap-accent)]/20 text-[var(--cap-accent)] border border-[var(--cap-accent)]/30">
                            {opt.meta.setCode}
                          </span>
                        )}
                        {opt.meta.dpi && (
                          <span className="text-[var(--cap-muted)]">{opt.meta.dpi}dpi</span>
                        )}
                        {opt.meta.userUploaded && (
                          <span className="text-[var(--cap-success)]">custom</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {slot.options.length === 0 && (
            <div className="py-16 text-center font-[family-name:var(--cap-font-mono)] text-sm text-[var(--cap-muted)] uppercase tracking-widest">
              no prints found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
