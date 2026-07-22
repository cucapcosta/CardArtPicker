import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, readFile, writeFile, stat, rename, unlink } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { existsSync } from "node:fs"

const DATA_DIR = process.env.MPC_DATA_DIR ?? resolve(process.cwd(), "../../scripts")
const INDEX_FILE = join(DATA_DIR, "mpcfill-index.json")
const STATE_FILE = process.env.MPC_STATE_FILE ?? join(DATA_DIR, ".mpcfill-scrape-state.json")
const PROGRESS_FILE = process.env.MPC_PROGRESS_FILE ?? join(DATA_DIR, ".mpcfill-scrape-progress.json")
const META_FILE = join(DATA_DIR, ".mpcfill-meta.json")
const LOG_TAIL_FILE = join(DATA_DIR, ".mpcfill-scrape.log")
const PID_FILE = join(DATA_DIR, ".mpcfill-scrape.pid")

const SCRAPER_SCRIPT = process.env.MPC_SCRAPER_SCRIPT
  ?? resolve(process.cwd(), "../../scripts/scrape-mpcfill-index.ts")

type RunState = "idle" | "running" | "error" | "done"

type Meta = {
  state: RunState
  startedAt?: string
  finishedAt?: string
  exitCode?: number
  error?: string
  source?: "scrape" | "upload"
}

type Progress = { step?: string; cursor?: number; total?: number; message?: string; ts?: string }

let child: ChildProcess | null = null
let logTail: string[] = []

async function loadJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T } catch { return null }
}

async function saveMeta(m: Meta) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(META_FILE, JSON.stringify(m))
}

async function isPidAlive(pid: number): Promise<boolean> {
  try { process.kill(pid, 0); return true } catch { return false }
}

export async function getStatus() {
  await mkdir(DATA_DIR, { recursive: true })
  const meta = (await loadJson<Meta>(META_FILE)) ?? { state: "idle" }
  const progress = await loadJson<Progress>(PROGRESS_FILE)

  if (meta.state === "running") {
    const inMemory = child && !child.killed && child.exitCode === null
    if (!inMemory) {
      const pidStr = await readFile(PID_FILE, "utf8").catch(() => "")
      const pid = Number(pidStr.trim())
      const alive = pid > 0 && (await isPidAlive(pid))
      if (!alive) {
        meta.state = "error"
        meta.error = "scraper process disappeared"
        meta.finishedAt = new Date().toISOString()
        await saveMeta(meta)
      }
    }
  }

  let indexInfo: { exists: boolean; size?: number; mtime?: string } = { exists: false }
  try {
    const s = await stat(INDEX_FILE)
    indexInfo = { exists: true, size: s.size, mtime: s.mtime.toISOString() }
  } catch {}

  return { meta, progress, indexFile: indexInfo, logTail: logTail.slice(-40) }
}

export async function startReindex(): Promise<{ ok: boolean; reason?: string }> {
  const status = await getStatus()
  if (status.meta.state === "running") return { ok: false, reason: "already running" }
  if (!existsSync(SCRAPER_SCRIPT)) return { ok: false, reason: `scraper missing: ${SCRAPER_SCRIPT}` }

  await mkdir(DATA_DIR, { recursive: true })
  await unlink(PROGRESS_FILE).catch(() => {})

  const meta: Meta = { state: "running", startedAt: new Date().toISOString(), source: "scrape" }
  await saveMeta(meta)

  logTail = []

  const env = {
    ...process.env,
    MPC_OUT_DIR: DATA_DIR,
    MPC_STATE_FILE: STATE_FILE,
    MPC_PROGRESS_FILE: PROGRESS_FILE,
  }

  const localTsx = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs")
  const rootTsx = resolve(process.cwd(), "../../node_modules/tsx/dist/cli.mjs")
  let cmd: string, args: string[]
  if (existsSync(localTsx)) { cmd = process.execPath; args = [localTsx, SCRAPER_SCRIPT] }
  else if (existsSync(rootTsx)) { cmd = process.execPath; args = [rootTsx, SCRAPER_SCRIPT] }
  else { cmd = "tsx"; args = [SCRAPER_SCRIPT] }

  const proc = spawn(cmd, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  })

  if (!proc.pid) return { ok: false, reason: "spawn failed" }
  child = proc

  await writeFile(PID_FILE, String(proc.pid)).catch(() => {})

  const onLine = (chunk: Buffer) => {
    const text = chunk.toString("utf8")
    for (const line of text.split("\n")) {
      if (!line) continue
      logTail.push(line)
      if (logTail.length > 200) logTail = logTail.slice(-200)
    }
    writeFile(LOG_TAIL_FILE, logTail.join("\n")).catch(() => {})
  }
  proc.stdout?.on("data", onLine)
  proc.stderr?.on("data", onLine)

  proc.on("exit", async (code) => {
    child = null
    const finished: Meta = {
      ...meta,
      state: code === 0 ? "done" : "error",
      finishedAt: new Date().toISOString(),
      exitCode: code ?? -1,
    }
    if (code !== 0) finished.error = logTail.slice(-5).join("\n").slice(0, 500)
    await saveMeta(finished)
    await unlink(PID_FILE).catch(() => {})
    if (code === 0) {
      try {
        const { picker } = await import("./picker")
        await picker.clearCache()
      } catch {}
    }
  })

  return { ok: true }
}

export async function applyUpload(buf: Buffer): Promise<{ ok: boolean; reason?: string }> {
  let parsed: unknown
  try { parsed = JSON.parse(buf.toString("utf8")) }
  catch { return { ok: false, reason: "not valid JSON" } }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "JSON must be object" }
  const obj = parsed as Record<string, unknown>
  if (!obj.card && !obj.token) return { ok: false, reason: "JSON missing card/token buckets" }

  await mkdir(DATA_DIR, { recursive: true })
  const tmp = `${INDEX_FILE}.tmp`
  await writeFile(tmp, buf)
  await rename(tmp, INDEX_FILE)

  const meta: Meta = {
    state: "done",
    source: "upload",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  }
  await saveMeta(meta)
  return { ok: true }
}

export const paths = { DATA_DIR, INDEX_FILE }
