import request from './http'
import type { Entry } from './search-types'

type Example = { text: string; translation: string | null; jyutping: string | null; audioUrl: string | null }
export type ContentBlock = { type: string; text: string | null; url: string | null; examples: Example[] }
export type V2Entry = {
  entryId: string; corpusId: number; entryName: string; meaning: string | null; jyutping: string | null
  contentAttribute: string; mediaTypes: string[]; available: boolean
  source: { categoryName: string; categoryDisplayName: string | null }
  category: { primary: { name: string } | null; secondary: { name: string } | null }
  tags: { precise: { name: string }[]; related: { name: string }[]; recommended: { name: string }[] }
  assets: { audioUrl: string | null; videoUrl: string | null; coverImage: string | null; model3dUrl: string | null; videoTranscript: string | null }
  content: {
    introduction: string | null; description: string | null; usageNotes: string | null
    song: { name: string; album: string | null; artist: string | null; composer: string | null; lyricist: string | null; jyutping: string | null } | null
    lyrics: { text: string; jyutping: string | null; durationSeconds: number | null }[]
    sections: { jyutping: string | null; blocks: ContentBlock[] }[]
  }
}
export type DisplayEntry = Omit<Entry, 'senses'> & {
  corpusId: number; categoryLine: string; primaryCategory: string; secondaryCategory: string; sceneTags: string[]; primaryTags: string[]; secondaryTags: string[]; audioUrl: string
  meaning: string | null; jyutping: string | null;
  assets: V2Entry['assets']; content: V2Entry['content']
}
export type SearchResponse = {
  schemaVersion: 2; query: string; requestId: string; primary: V2Entry | null; similar: V2Entry[]; recommended: V2Entry[]
  sectionStatus: { primary: 'idle' | 'loading' | 'success' | 'error'; semantic: 'idle' | 'loading' | 'success' | 'error' | 'fallback' }
  cursors: { similarNext: string | null; recommendedNext: string | null }
}
export function normalizeEntry(row: V2Entry): DisplayEntry {
  const secondary = row.category.secondary?.name
  const primaryTags = Array.from(new Set([...row.tags.precise, ...row.tags.related].map(tag => tag.name)))
  const secondaryTags = Array.from(new Set(row.tags.recommended.map(tag => tag.name))).filter(name => !primaryTags.includes(name))
  return {
    id: row.entryId, expression: row.entryName, corpusId: row.corpusId, available: row.available,
    source: { datasetSlug: row.source.categoryName, datasetName: row.source.categoryDisplayName || row.source.categoryName, licenses: [] },
    categoryLine: [row.category.primary?.name, secondary].filter(Boolean).join(' › '),
    primaryCategory: row.category.primary?.name || '', secondaryCategory: secondary || '',
    sceneTags: Array.from(new Set([...row.tags.precise, ...row.tags.related, ...row.tags.recommended].map(tag => tag.name))).filter(name => name !== secondary),
    meaning: row.meaning, jyutping: row.jyutping,
    primaryTags, secondaryTags, audioUrl: row.assets.audioUrl || '', assets: row.assets, content: row.content,
  }
}
export async function fetchSearch(query: string, requestId: string, options: { part?: 'similar' | 'recommended'; cursor?: string | null; primaryCorpusId?: number | null; semanticRetry?: boolean; mediaType?: string } = {}): Promise<SearchResponse> {
  const params = [`q=${encodeURIComponent(query)}`, `requestId=${encodeURIComponent(requestId)}`, `section=${options.part || options.semanticRetry ? 'semantic' : 'all'}`]
  if (options.mediaType) params.push(`mediaType=${encodeURIComponent(options.mediaType)}`)
  if (options.part) {
    params.push(`semanticPart=${options.part}`)
    if (options.cursor !== null && options.cursor !== undefined) params.push(`${options.part}Cursor=${encodeURIComponent(options.cursor)}`)
  }
  if (options.part || options.semanticRetry) params.push(`primaryCorpusId=${options.primaryCorpusId == null ? 'none' : encodeURIComponent(String(options.primaryCorpusId))}`)
  const response = await request<SearchResponse>(`/search/v2/entries?${params.join('&')}`, { auth: false })
  if (response.schemaVersion !== 2) throw new Error('搜索服务版本不匹配')
  return response
}
export async function fetchEntry(id: string): Promise<DisplayEntry> {
  const response = await request<{ schemaVersion: number; entry: V2Entry }>(`/search/v2/entries/${encodeURIComponent(id)}`, { auth: false })
  if (response.schemaVersion !== 2) throw new Error('详情服务版本不匹配')
  return normalizeEntry(response.entry)
}
