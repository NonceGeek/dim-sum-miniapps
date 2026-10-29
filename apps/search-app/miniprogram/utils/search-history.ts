export type SearchHistoryItem = { word: string; phonetic: string }
const storageKey = 'cantonese-search-history'

export function readSearchHistory(): SearchHistoryItem[] {
  const stored: unknown = wx.getStorageSync(storageKey)
  if (!Array.isArray(stored)) return []
  return stored.filter(item => item && typeof item.word === 'string' && item.word.trim())
    .map(item => ({ word: item.word.trim(), phonetic: typeof item.phonetic === 'string' ? item.phonetic : '' })).slice(0, 20)
}

export function saveSearchHistory(keyword: string): SearchHistoryItem[] {
  const word = keyword.trim()
  const previous = readSearchHistory()
  if (!word || word.length > 100) return previous
  const phonetic = previous.find(item => item.word === word)?.phonetic || ''
  const history = [{ word, phonetic }, ...previous.filter(item => item.word !== word)].slice(0, 20)
  wx.setStorageSync(storageKey, history)
  return history
}
