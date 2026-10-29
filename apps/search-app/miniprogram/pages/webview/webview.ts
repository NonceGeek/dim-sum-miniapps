import { trackPage } from '../../utils/analytics'
Page({
  onShow() { trackPage(this) },
  data: { url: '' },
  onLoad(options: { url?: string }) {
    let url = ''
    try { url = decodeURIComponent(options.url || '') } catch (_) {}
    if (!['https://search.aidimsum.com/terms', 'https://search.aidimsum.com/privacy'].includes(url)) {
      wx.showToast({ title: '链接无效', icon: 'none' })
      return
    }
    this.setData({ url })
  },
})
export {}
