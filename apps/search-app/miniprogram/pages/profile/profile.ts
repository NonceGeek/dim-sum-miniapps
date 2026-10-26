import { applyAppearance } from '../../utils/appearance'
import { showCommonDialog } from '@dim-sum/common-dialog'
import { requireLogin } from '../../utils/auth'
Page({
  data: { isLoggedIn: false, displayName: '游客', avatarText: '点', avatarUrl: '', version: '1.0.0', historyCount: 0, activePopup: '', feedbackTypes: ['内容有误', '发音问题', '功能建议', '其他问题'], feedbackTypeIndex: 0, feedbackText: '', menuItems: [
    { key: 'history', icon: 'history', title: '最近查询', hint: '' },
    { key: 'appearance', icon: 'palette', title: '外观模式', hint: '' },
    { key: 'feedback', icon: 'service', title: '问题反馈', hint: '欢迎提建议' },
    { key: 'about', icon: 'info-circle', title: '关于平台', hint: '' },
  ] },
  onShow() {
    applyAppearance(this)
    this.syncAuthState()
    try { const version = wx.getAccountInfoSync().miniProgram.version; if (version) this.setData({ version }) } catch (error) { console.warn('Version unavailable', error) }
    const bar = this.getTabBar(); if (bar) bar.setData({ value: '/pages/profile/profile', hidden: Boolean(this.data.activePopup) })
    try {
      const history = wx.getStorageSync('cantonese-search-history')
      this.setData({ historyCount: Array.isArray(history) ? history.length : 0 })
    } catch (error) { console.warn('Profile storage unavailable', error) }
  },
  syncAuthState() {
    const { userInfo, accessToken, refreshToken } = getApp<IAppOption>().globalData
    const isLoggedIn = Boolean(userInfo && (accessToken || refreshToken))
    this.setData({ isLoggedIn, displayName: isLoggedIn ? (userInfo?.name || '我的粤语口袋') : '游客', avatarText: isLoggedIn ? (userInfo?.name || '我').slice(0, 1) : '点', avatarUrl: isLoggedIn ? userInfo?.avatar || '' : '' })
  },
  onAvatarTap() {
    if (this.data.isLoggedIn) return

    wx.navigateTo({ url: '/pages/login/login?returnToPrevious=1', fail: () => wx.showToast({ title: '登录页面打开失败', icon: 'none' }) })
  },
  onLogoutTap() {
    const app = getApp<IAppOption>()
    if (!app.globalData.userInfo) {
      wx.showToast({ title: '当前未登录', icon: 'none' })
      return
    }
    showCommonDialog(this, { title: '退出登录？', content: '退出后保留当前设备的查询记录和外观设置。', showCancel: true, onConfirm: () => {
      app.logout()
      this.syncAuthState()
      wx.showToast({ title: '已退出登录', icon: 'success' })
    } })
  },
  async onMenuTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { key: string }>) {
    const key = event.currentTarget.dataset.key
    if (key === 'appearance') {
      wx.showActionSheet({ itemList: ['跟随系统', '浅色', '深色'], success: res => {
        try { wx.setStorageSync('cantonese-appearance', ['system', 'light', 'dark'][res.tapIndex]); applyAppearance(this) }
        catch (error) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }) }
      }, fail: () => {} }); return
    }
    if (key === 'feedback' && !await requireLogin(this)) return
    if (key === 'about' || key === 'feedback') { this.setData({ activePopup: key }); const bar = this.getTabBar(); if (bar) bar.setData({ hidden: true }); return }
    try {
      const stored = wx.getStorageSync('cantonese-search-history')
      const words = Array.isArray(stored) ? stored.filter(item => item && typeof item.word === 'string').map(item => item.word) : []
      if (!words.length) { wx.showToast({ title: '还没有查询记录', icon: 'none' }); return }
      wx.showActionSheet({ itemList: words.slice(0, 6), success: res => wx.navigateTo({ url: '/pages/search-result/search-result?keyword=' + encodeURIComponent(words[res.tapIndex]), fail: () => wx.showToast({ title: '页面打开失败', icon: 'none' }) }), fail: () => {} })
    } catch (error) { wx.showToast({ title: '读取失败，请重试', icon: 'none' }) }
  },
  closePopup() { this.setData({ activePopup: '' }); const bar = this.getTabBar(); if (bar) bar.setData({ hidden: false }) },
  onPopupContentTap() {},
  onFeedbackTypeTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { index: number }>) {
    this.setData({ feedbackTypeIndex: Number(event.currentTarget.dataset.index) })
  },
  onFeedbackInput(event: any) {
    this.setData({ feedbackText: event.detail.value })
  },
  async onFeedbackSave() {
    if (!await requireLogin(this)) { this.closePopup(); return }
    const text = this.data.feedbackText.trim()
    if (!text) { wx.showToast({ title: '请描述问题或建议', icon: 'none' }); return }
    try {
      const previous = wx.getStorageSync('cantonese-local-feedback')
      const list = Array.isArray(previous) ? previous : []
      wx.setStorageSync('cantonese-local-feedback', [...list, { type: this.data.feedbackTypes[this.data.feedbackTypeIndex], text, createdAt: Date.now() }])
      this.setData({ activePopup: '', feedbackText: '', feedbackTypeIndex: 0 })
      const bar = this.getTabBar(); if (bar) bar.setData({ hidden: false })
      wx.showToast({ title: '反馈已保存', icon: 'success' })
    } catch (error) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }) }
  },
  onClearCache() {
    showCommonDialog(this, { title: '清理临时缓存？', content: '仅清理临时检索缓存，保留收藏、查询记录和本地反馈。', showCancel: true, onConfirm: () => {
      try { wx.removeStorageSync('cantonese-search-cache'); wx.showToast({ title: '临时缓存已清理', icon: 'none' }) }
      catch (error) { wx.showToast({ title: '清理失败，请重试', icon: 'none' }) }
    } })
  },
})
export {}
