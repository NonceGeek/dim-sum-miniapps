/** 每次业务操作生成新 ID；重试由调用方复用。 */
export function createRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16)
    return (character === 'x' ? value : (value & 3) | 8).toString(16)
  })
}

let anonymousId = ''
export function getAnonymousId(): string {
  if (anonymousId) return anonymousId
  try {
    const key = 'cantonese-anonymous-id'
    const stored = wx.getStorageSync(key)
    if (typeof stored === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) { anonymousId = stored; return stored }
    const id = createRequestId()
    anonymousId = id
    wx.setStorageSync(key, id)
    return id
  } catch (_) {
    return anonymousId || (anonymousId = createRequestId())
  }
}
