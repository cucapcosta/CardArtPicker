"use server"

import type { CardIdentifier, ParsedList, Picker, Selection, SourceResult } from "../types.js"

export function createActions(picker: Picker) {
  async function searchCardAction(id: CardIdentifier): Promise<SourceResult[]> {
    return picker.searchCard(id)
  }
  async function parseListAction(text: string): Promise<ParsedList> {
    return picker.parseList(text)
  }
  async function downloadAction(_selections: Selection[]): Promise<never> {
    throw new Error("Use the POST /api/cardartpicker/download route from the client; server actions cannot stream Blob responses cleanly.")
  }
  return { searchCardAction, parseListAction, downloadAction }
}
