export type Sense = {
  meaning: string; jyutping: string | null; audio: string | null; usageNotes: string | null
  examples: { text: string; translation: string | null; jyutping: string | null; audio: string | null }[]
}
export type Entry = {
  id: string; expression: string; senses: Sense[]
  source: { datasetSlug: string; datasetName: string; licenses: string[] }; available: boolean
}
