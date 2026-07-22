"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Status = {
  meta: {
    state: "idle" | "running" | "error" | "done"
    startedAt?: string
    finishedAt?: string
    exitCode?: number
    error?: string
    source?: "scrape" | "upload"
  }
  progress?: { step?: string; cursor?: number; total?: number; ts?: string } | null
  indexFile: { exists: boolean; size?: number; mtime?: string }
  logTail: string[]
}

const SECRET_STORAGE_KEY = "cap-admin-secret"

function fmtBytes(n?: number) {
  if (!n) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1_048_576).toFixed(1)} MB`
}

export default function AdminPage() {
  const [secret, setSecret] = useState<string>("")
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const v = sessionStorage.getItem(SECRET_STORAGE_KEY)
    if (v) setSecret(v)
  }, [])

  const persistSecret = (v: string) => {
    setSecret(v)
    if (v) sessionStorage.setItem(SECRET_STORAGE_KEY, v)
    else sessionStorage.removeItem(SECRET_STORAGE_KEY)
  }

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/status", { cache: "no-store" })
      if (r.ok) setStatus(await r.json())
    } catch {}
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 2000)
    return () => clearInterval(id)
  }, [refresh])

  const reindex = async () => {
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/reindex", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) setMsg(`error: ${body.error ?? r.statusText}`)
      else setMsg("reindex started")
      refresh()
    } finally { setBusy(false) }
  }

  const upload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!f) { setMsg("pick a file first"); return }
    setBusy(true); setMsg("")
    try {
      const fd = new FormData()
      fd.append("file", f)
      const r = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        body: fd,
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) setMsg(`error: ${body.error ?? r.statusText}`)
      else setMsg(`uploaded ${fmtBytes(body.bytes)}`)
      refresh()
    } finally { setBusy(false) }
  }

  const m = status?.meta
  const p = status?.progress
  const pct = p?.cursor != null && p?.total ? ((p.cursor / p.total) * 100).toFixed(1) : null

  return (
    <main>
      <div className="lt-bar">
        <span><span className="dot" />cardartpicker · admin</span>
        <a href="/" style={{ color: "inherit" }}>← back</a>
      </div>
      <div style={{ padding: "1.5rem", display: "grid", gap: "1.5rem", maxWidth: 760 }}>
        <section>
          <label style={{ display: "block", fontSize: "0.7rem", color: "var(--color-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            REINDEX_SECRET
          </label>
          <input
            type="password"
            value={secret}
            onChange={e => persistSecret(e.target.value)}
            placeholder="bearer token"
            style={{
              width: "100%", padding: "0.5rem 0.75rem",
              background: "var(--color-surface)", color: "var(--color-fg)",
              border: "1px solid var(--color-edge)", borderRadius: 2,
              fontFamily: "var(--font-mono)", fontSize: "0.85rem",
            }}
          />
        </section>

        <section>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Index
          </h3>
          <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", display: "grid", gap: "0.25rem" }}>
            <div>file: {status?.indexFile.exists ? "present" : "missing"}</div>
            <div>size: {fmtBytes(status?.indexFile.size)}</div>
            <div>mtime: {status?.indexFile.mtime ?? "—"}</div>
          </div>
        </section>

        <section>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Status
          </h3>
          <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", display: "grid", gap: "0.25rem" }}>
            <div>state: <span style={{ color: m?.state === "error" ? "salmon" : m?.state === "running" ? "var(--color-accent)" : "var(--color-fg)" }}>{m?.state ?? "—"}</span></div>
            <div>source: {m?.source ?? "—"}</div>
            <div>started: {m?.startedAt ?? "—"}</div>
            <div>finished: {m?.finishedAt ?? "—"}</div>
            {p?.step && <div>step: {p.step} {pct ? `(${pct}%)` : ""} {p.cursor != null ? `${p.cursor}/${p.total}` : ""}</div>}
            {m?.error && <div style={{ color: "salmon" }}>error: {m.error}</div>}
          </div>
        </section>

        <section style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={reindex}
            disabled={busy || !secret || m?.state === "running"}
            style={btnStyle}
          >
            {m?.state === "running" ? "running…" : "Reindex"}
          </button>
          <input ref={fileRef} type="file" accept="application/json" style={{ color: "var(--color-muted)" }} />
          <button onClick={upload} disabled={busy || !secret} style={btnStyle}>
            Upload
          </button>
        </section>

        {msg && <div style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>{msg}</div>}

        <section>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Log
          </h3>
          <pre style={{
            background: "var(--color-surface)", border: "1px solid var(--color-edge)",
            padding: "0.75rem", borderRadius: 2, fontSize: "0.75rem",
            maxHeight: 240, overflow: "auto", margin: 0,
          }}>
            {(status?.logTail ?? []).join("\n") || "(empty)"}
          </pre>
        </section>
      </div>
    </main>
  )
}

const btnStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "var(--color-surface)",
  color: "var(--color-fg)",
  border: "1px solid var(--color-edge)",
  borderRadius: 2,
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: "0.85rem",
}
