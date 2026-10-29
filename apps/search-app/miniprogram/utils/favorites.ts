const key = 'cantonese-favorites'
function entryId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const row = value as { id?: unknown; entryId?: unknown }
    return typeof row.id === 'string' ? row.id : typeof row.entryId === 'string' ? row.entryId : ''
  }
  return ''
}
function read(): unknown[] {
  const stored: unknown = wx.getStorageSync(key)
  return Array.isArray(stored) ? stored : []
}
export function isFavorite(id: string): boolean { return read().some(value => entryId(value) === id) }
export function toggleFavorite(entry: { id: string; word: string; phonetic: string }): boolean {
  const records = read()
  const exists = records.some(value => entryId(value) === entry.id)
  const next = records.filter(value => entryId(value) !== entry.id)
  if (!exists) next.unshift({ ...entry, savedAt: Date.now() })
  wx.setStorageSync(key, next)
  return !exists
}
