import { requireLogin } from '../../utils/auth'
import { showCommonDialog } from '@dim-sum/common-dialog'
import { applyAppearance } from '../../utils/appearance'
import { readSearchHistory, type SearchHistoryItem } from '../../utils/search-history'
Page({
  data: { authorized: false, history: [] as SearchHistoryItem[] },
  async onShow() {
    applyAppearance(this)
    this.setData({ authorized: false, history: [] })
    if (!await requireLogin(this)) return
    try { this.setData({ authorized: true, history: readSearchHistory() }) }
    catch (_) { wx.showToast({ title: '读取失败，请重试', icon: 'none' }) }
  },
  onQueryTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { word: string }>) {
    if (!this.data.authorized) return
    const word = event.currentTarget.dataset.word
    if (word) wx.navigateTo({ url: `/pages/search-result/search-result?keyword=${encodeURIComponent(word)}`, fail: () => wx.showToast({ title: '页面打开失败', icon: 'none' }) })
  },
  onRemoveQuery(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { word: string }>) {
    if (!this.data.authorized) return
    try {
      const history = readSearchHistory().filter(item => item.word !== event.currentTarget.dataset.word)
      wx.setStorageSync('cantonese-search-history', history)
      this.setData({ history })
    } catch (_) { wx.showToast({ title: '删除失败，请重试', icon: 'none' }) }
  },
  onClearHistory() {
    if (!this.data.authorized) return
    showCommonDialog(this, { title: '清空浏览记录？', content: '清空后无法恢复。', showCancel: true, confirmText: '清空', onConfirm: () => {
      try { wx.removeStorageSync('cantonese-search-history'); this.setData({ history: [] }) }
      catch (_) { wx.showToast({ title: '清空失败，请重试', icon: 'none' }) }
    } })
  },
})
