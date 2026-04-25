import { readFile, writeFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"

async function walk(dir: string, out: string[]) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, out)
    else if (entry.name.endsWith(".md")) out.push(p)
  }
  return out
}

async function main() {
  const root = "docs"
  const files = await walk(root, [])
  files.sort()
  const parts: string[] = []
  for (const f of files) {
    if (f.endsWith("llms.txt") || f.includes("superpowers/")) continue
    parts.push(`\n\n<!-- ===== ${relative(".", f)} ===== -->\n\n`)
    parts.push(await readFile(f, "utf-8"))
  }
  await writeFile(join(root, "llms-full.txt"), parts.join(""), "utf-8")
  console.log(`wrote docs/llms-full.txt (${files.length} files)`)
}

main()
