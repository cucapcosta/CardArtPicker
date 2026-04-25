"use client"

import { usePickerContext, type PickerState } from "./CardPickerProvider.js"

export function useCardPicker(): PickerState {
  return usePickerContext()
}
