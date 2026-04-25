"use client"

import { createContext, useContext, type ReactNode } from "react"

type PickerContextValue = { apiBase: string }

const PickerContext = createContext<PickerContextValue | null>(null)

export function CardPickerProvider({ children, apiBase = "/api/cardartpicker" }: { children: ReactNode; apiBase?: string }) {
  return <PickerContext.Provider value={{ apiBase }}>{children}</PickerContext.Provider>
}

export function usePickerContext(): PickerContextValue {
  const ctx = useContext(PickerContext)
  if (!ctx) throw new Error("useCardPicker must be used within <CardPickerProvider>")
  return ctx
}
