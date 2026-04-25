import { createHandlers } from "cardartpicker/server"
import { picker } from "@/lib/picker"

export const { GET, POST } = createHandlers(picker)
