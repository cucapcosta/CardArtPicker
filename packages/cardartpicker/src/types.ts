// packages/cardartpicker/src/types.ts
export type CardType = "card" | "token"

export type CardIdentifier = {
  name: string
  setHint?: string
  collectorHint?: string
  type: CardType
}

export type CardOption = {
  id: string
  sourceName: string
  cardName: string
  imageUrl: string
  thumbnailUrl?: string
  backImageUrl?: string
  meta: {
    setCode?: string
    collectorNumber?: string
    artist?: string
    dpi?: number
    language?: string
    tags?: string[]
    userUploaded?: boolean
  }
}

export type SourcePageOptions = { offset?: number; limit?: number }

export type SourcePage = {
  options: CardOption[]
  total: number
  hasMore: boolean
}

export type Source = {
  name: string
  getOptions(id: CardIdentifier, opts?: SourcePageOptions): Promise<SourcePage>
  getImage?(optionId: string): Promise<ArrayBuffer>
}

export type SourceResult =
  | { ok: true; source: string; options: CardOption[]; total: number; hasMore: boolean }
  | { ok: false; source: string; error: { code: string; message: string } }

export type ParsedLine = { quantity: number } & CardIdentifier

export type ParsedList = {
  mainboard: ParsedLine[]
  tokens: ParsedLine[]
  warnings: Array<{ line: number; raw: string; reason: string }>
}

export type SlotStatus = "loading" | "ready" | "partial" | "not-found" | "error"

export type Slot = {
  id: string
  section: "mainboard" | "tokens"
  cardName: string
  quantity: number
  identifier: CardIdentifier
  options: CardOption[]
  selectedOptionId: string | null
  flipped: boolean
  status: SlotStatus
  sourceErrors: Array<{ source: string; message: string }>
  totalOptions: number
  hasMoreOptions: boolean
}

export type Selections = Record<string, string>

export type Selection = { slotId: string; optionId: string; quantity: number }

export type CacheAdapter = {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}

export type UploadAdapter = {
  save(option: CardOption): Promise<void>
  loadAll(): Promise<CardOption[]>
  remove(id: string): Promise<void>
}

export type LogLevel = "debug" | "info" | "warn" | "error"
export type Logger = (level: LogLevel, event: string, ctx?: unknown) => void

export type PickerConfig = {
  sources: Source[]
  uploadPersistence?: "localStorage" | "session" | UploadAdapter
  cacheTTL?: number
  cacheBackend?: CacheAdapter
  parserStrict?: boolean
  sourceTimeoutMs?: number
  optionsPageSize?: number
  logger?: Logger
  onDownloadStart?: (selections: Selection[]) => void
  onDownloadComplete?: (zip: Blob) => void
  downloadFilename?: (ctx: { selections: Selection[] }) => string
}

export type Picker = {
  readonly config: Required<Pick<PickerConfig, "cacheTTL" | "sourceTimeoutMs" | "parserStrict" | "optionsPageSize">> & PickerConfig
  searchCard(id: CardIdentifier, opts?: SourcePageOptions): Promise<SourceResult[]>
  getDefaultPrint(name: string, type?: CardType): Promise<CardOption | null>
  buildZip(selections: Selection[]): Promise<Blob>
  parseList(text: string): ParsedList
}
