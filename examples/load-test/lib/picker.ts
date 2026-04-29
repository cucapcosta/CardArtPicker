import { createPicker } from "cardartpicker"
import { scryfall, mpcFill } from "cardartpicker/sources"

export const picker = createPicker({
  sources: [scryfall, mpcFill],
  uploadPersistence: "session",
  cacheTTL: 86_400,
})
