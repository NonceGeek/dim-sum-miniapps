import { applyAppearance } from '../../utils/appearance'
import { showCommonDialog } from '@dim-sum/common-dialog'
import { requireLogin } from '../../utils/auth'
import request from '../../utils/http'
import { createRequestId, getAnonymousId } from '../../utils/identity'

const feedbackTypeCodes = ['content_error', 'audio_issue', 'suggestion', 'other']
const feedbackErrors: Record<string, string> = {
  INVALID_FEEDBACK: '请检查反馈类型及内容（1–300 字）',
  INVALID_TOKEN: '登录状态已失效，请重新登录',
  REQUEST_CONFLICT: '该反馈的提交内容已变化，请修改后重新提交',
  ENTRY_UNAVAILABLE: '关联内容已不可用，请重新提交通用反馈',
  BODY_TOO_LARGE: '反馈内容过长，请精简后重试',
  RATE_LIMITED: '提交较频繁，请 10 分钟后再试',
  SERVICE_UNAVAILABLE: '服务暂不可用，请稍后重试',
}
Page({
  data: { isLoggedIn: false, displayName: '游客', avatarText: '点', avatarUrl: '', version: '1.0.0', historyCount: 0, activePopup: '', feedbackTypes: ['内容有误', '发音问题', '功能建议', '其他问题'], feedbackTypeIndex: 0, feedbackText: '', feedbackSubmitting: false, feedbackRequestId: '', feedbackSignature: '', menuItems: [
    { key: 'history', icon: 'history', title: '最近查询', hint: '' },
    { key: 'appearance', icon: 'sunny', title: '外观模式', hint: '' },
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
  closePopup() { if (this.data.feedbackSubmitting) return; this.setData({ activePopup: '' }); const bar = this.getTabBar(); if (bar) bar.setData({ hidden: false }) },
  onPopupContentTap() {},
  onFeedbackTypeTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { index: number }>) {
    if (this.data.feedbackSubmitting) return
    const index = Number(event.currentTarget.dataset.index)
    if (!Number.isInteger(index) || !feedbackTypeCodes[index]) return
    if (index !== this.data.feedbackTypeIndex) this.setData({ feedbackTypeIndex: index, feedbackRequestId: '', feedbackSignature: '' })
  },
  onFeedbackInput(event: any) {
    if (this.data.feedbackSubmitting) return
    if (event.detail.value !== this.data.feedbackText) this.setData({ feedbackText: event.detail.value, feedbackRequestId: '', feedbackSignature: '' })
  },
  async onFeedbackSave() {
    if (this.data.feedbackSubmitting) return
    const description = this.data.feedbackText.trim()
    const type = feedbackTypeCodes[this.data.feedbackTypeIndex]
    if (!description || description.length > 300 || !type) {
      wx.showToast({ title: '请填写 1–300 字的问题描述', icon: 'none' })
      return
    }
    this.setData({ feedbackSubmitting: true })
    try {
      if (!await requireLogin(this)) return
      const userId = getApp<IAppOption>().globalData.userInfo?.id
      if (!userId) { wx.showToast({ title: '请重新登录后提交', icon: 'none' }); return }
      const anonymousId = getAnonymousId()
      const signature = JSON.stringify([userId, anonymousId, type, description])
      const requestId = signature === this.data.feedbackSignature && this.data.feedbackRequestId
        ? this.data.feedbackRequestId : createRequestId()
      this.setData({ feedbackRequestId: requestId, feedbackSignature: signature })
      await request('/miniprogram/search/feedback', {
        method: 'POST', auth: true,
        data: { requestId, anonymousId, type, description },
      })
      this.setData({ activePopup: '', feedbackText: '', feedbackTypeIndex: 0, feedbackRequestId: '', feedbackSignature: '' })
      const bar = this.getTabBar(); if (bar) bar.setData({ hidden: false })
      wx.showToast({ title: '反馈已提交', icon: 'success' })
    } catch (error) {
      const failure = error as { data?: { error?: string; code?: string }; statusCode?: number }
      const code = failure.data?.error || failure.data?.code || ''
      const title = feedbackErrors[code] || (failure.statusCode === 429 ? feedbackErrors.RATE_LIMITED : '提交失败，请重试')
      wx.showToast({ title, icon: 'none' })
    } finally {
      this.setData({ feedbackSubmitting: false })
    }
  },
  onClearCache() {
    showCommonDialog(this, { title: '清理临时缓存？', content: '仅清理临时检索缓存，保留收藏、查询记录和本地反馈。', showCancel: true, onConfirm: () => {
      try { wx.removeStorageSync('cantonese-search-cache'); wx.showToast({ title: '临时缓存已清理', icon: 'none' }) }
      catch (error) { wx.showToast({ title: '清理失败，请重试', icon: 'none' }) }
    } })
  },
})
export {}
