import { createPicker } from "cardartpicker"
import { scryfall, createMpcFillIndex } from "cardartpicker/sources"
import type { Source } from "cardartpicker"
import { dynamicMpcSource } from "./dynamic-mpc"

const indexUrl = process.env.MPC_FILL_INDEX_URL

const sources: Source[] = [scryfall]
if (indexUrl) sources.push(createMpcFillIndex({ indexUrl }))
else sources.push(dynamicMpcSource)

export const picker = createPicker({
  sources,
  uploadPersistence: "session",
  cacheTTL: 86_400,
})
