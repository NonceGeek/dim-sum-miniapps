export function openModelViewer(entryId: string, url: string) {
  if (!entryId || !url) return
  wx.navigateTo({ url: `/pages/model-viewer/model-viewer?id=${encodeURIComponent(entryId)}&resource=${encodeURIComponent(url)}`, fail: () => wx.showToast({ title: '模型页面打开失败', icon: 'none' }) })
}

/** Decode the route envelope once, without changing escapes inside a raw/signed resource URL. */
export function decodeModelResource(value: string): string {
  if (!/^https%3a%2f%2f/i.test(value)) return value
  try { return decodeURIComponent(value) } catch (_) { return '' }
}
