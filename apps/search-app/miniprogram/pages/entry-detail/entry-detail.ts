import { VideoAnalytics } from '../../utils/media-analytics'
import { PageAudio, videoHandlers } from '../../utils/page-media'
import { track, trackPage, feedbackOutcome } from '../../utils/analytics'
import { requireLogin } from '../../utils/auth'
import request from '../../utils/http'
import { createRequestId, getAnonymousId } from '../../utils/identity'
import { invalidateDailyEntry } from '../../utils/daily-entry'
import { isFavorite, toggleFavorite } from '../../utils/favorites'
import { buildDetailContent } from '../../utils/detail-content'
import { openModelViewer } from '../../utils/model-viewer'
import { applyAppearance } from '../../utils/appearance'
import { fetchEntry, type DisplayEntry } from '../../utils/search-v2'

Page({
  data: { shareVisible: false, feedbackVisible: false, shareExample: '', feedbackTypes: ['内容有误', '发音问题', '功能建议', '其他问题'], feedbackType: 0, feedbackText: '', feedbackSubmitting: false, detailBottomSpace: 180, showLearning: false, favorited: false, learnExpanded: false, meaningRevealed: false, practiceCompleted: false, practiceMeaning: '', practiceAudio: '', modelScrollOffset: 0, modelViewportTop: 0, modelViewportBottom: 0, id: '', detailContent: null as ReturnType<typeof buildDetailContent> | null, entry: null as DisplayEntry | null, loading: true, error: '', unavailable: false, playingUrl: '' },
  _mediaVisible: true,
  _videos: null as VideoAnalytics | null,
  _audio: null as PageAudio | null,
  audio(): PageAudio { return this._audio || (this._audio = new PageAudio()) },
  ...videoHandlers,
  _searchQuery: '',
  _searchSection: '',
  _shareId: '',
  _incomingShare: '',
  _landingVisitId: '',
  onLoad(options: { id?: string; from?: string; sid?: string; query?: string; section?: string }) {
    if (options.from === 'share' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.sid || '')) { this._incomingShare = options.sid!; this._landingVisitId = createRequestId() }
    if (options.query && ['primary', 'similar', 'recommended'].includes(options.section || '')) { this._searchQuery = options.query.trim().slice(0, 100); this._searchSection = options.section! }
    this.setData({ id: options.id || '' })
    this.loadEntry()
  },
  onReady() { this.measureBottomBar() },
  onResize() { this.measureBottomBar() },
  measureBottomBar() {
    this.createSelectorQuery().select('.detail-bottom-bar').boundingClientRect(rect => {
      if (!rect || Array.isArray(rect)) return
      const windowHeight = wx.getSystemInfoSync().windowHeight
      this.setData({ detailBottomSpace: rect.height + 24, modelViewportBottom: windowHeight - rect.height })
    }).exec()
  },
  onPageScroll(event: WechatMiniprogram.Page.IPageScrollOption) { this.setData({ modelScrollOffset: event.scrollTop }) },
  onShow() { this._mediaVisible = true; trackPage(this);
    applyAppearance(this)
    wx.nextTick(() => this.measureBottomBar())
    try { this.setData({ favorited: isFavorite(this.data.id) }) } catch (_) {}
  },
  onHide() { this._mediaVisible = false; this._videos?.suspend(); this._audio?.stop(); this.setData({ playingUrl: '' }) },
  onUnload() { this._mediaVisible = false; this._videos?.clear(); this._audio?.destroy() },
  async loadEntry() {
    if (this.data.loading && this.data.entry) return
    if (!this.data.id) { this.setData({ loading: false, unavailable: true, error: '该内容暂不可用' }); return }
    this.setData({ loading: true, error: '', unavailable: false })
    try {
      const entry = await fetchEntry(this.data.id)
      if (this._incomingShare) {
        track('share_link_open', { entryId: entry.id, shareId: this._incomingShare, landingVisitId: this._landingVisitId, sourceChannel: 'shared_link' })
        this._incomingShare = ''
      }
      const detailContent = buildDetailContent(entry)
      const practiceMeaning = entry.meaning || entry.content.sections.flatMap(section => section.blocks).find(block => block.type === 'definition' && block.text)?.text || ''
      const practiceAudio = entry.assets.audioUrl || detailContent.sections.find(section => section.audio)?.audio || ''
      this.setData({ entry, detailContent, practiceMeaning, practiceAudio, shareExample: entry.content.sections.flatMap(section => section.blocks).find(block => block.type === 'example' && block.examples.length)?.examples[0]?.text || '', loading: false }, () => this.measureBottomBar())
    } catch (error) {
      const unavailable = (error as { statusCode?: number }).statusCode === 404
      if (unavailable) invalidateDailyEntry(this.data.id)
      this.setData({ loading: false, unavailable, error: unavailable ? '该内容暂不可用' : '加载失败，请重试' }, () => this.measureBottomBar())
    }
  },
  onShareTap() { this._shareId = createRequestId(); this.setData({ shareVisible: true, feedbackVisible: false }, () => { if (this.data.shareVisible && this.data.entry) track('share_card_open', { entryId: this.data.id, shareId: this._shareId, surface: 'miniprogram' }) }) },
  onShareClose() { if (!this.data.feedbackSubmitting) this.setData({ shareVisible: false }) },
  onSheetContentTap() {},
  async onOpenFeedback() {
    if (this.data.feedbackSubmitting) return
    this.setData({ shareVisible: false })
    if (!await requireLogin(this, () => this.setData({ feedbackVisible: true }))) return
    this.setData({ feedbackVisible: true })
  },
  onFeedbackClose() { if (!this.data.feedbackSubmitting) this.setData({ feedbackVisible: false }) },
  onCopyShare() {
    const entry = this.data.entry
    if (!entry) return
    wx.setClipboardData({ data: [entry.expression, entry.jyutping, entry.meaning, this.data.shareExample, '粤语随手查'].filter(Boolean).join('\n') })
  },
  _feedbackId: '',
  _feedbackSignature: '',
  onFeedbackType(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { index: number }>) {
    if (!this.data.feedbackSubmitting) this.setData({ feedbackType: Number(event.currentTarget.dataset.index) })
  },
  onFeedbackInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    if (!this.data.feedbackSubmitting) this.setData({ feedbackText: event.detail.value })
  },
  async onFeedbackSubmit() {
    if (this.data.feedbackSubmitting) return
    const description = this.data.feedbackText.trim()
    if (!description || description.length > 300) { wx.showToast({ title: '请填写 1–300 字的问题描述', icon: 'none' }); return }
    this.setData({ feedbackSubmitting: true })
    try {
      if (!await requireLogin(this)) return
      const type = ['content_error', 'audio_issue', 'suggestion', 'other'][this.data.feedbackType]
      const anonymousId = getAnonymousId()
      const signature = JSON.stringify([getApp<IAppOption>().globalData.userInfo?.id, anonymousId, this.data.id, type, description])
      if (signature !== this._feedbackSignature) { this._feedbackId = createRequestId(); this._feedbackSignature = signature }
      const feedback = await request<{ id: string }>('/search/feedback', { method: 'POST', auth: true, data: { requestId: this._feedbackId, anonymousId, entryId: this.data.id, type, description } }).catch(error => { feedbackOutcome(this._feedbackId, type, undefined, error); throw error })
      feedbackOutcome(this._feedbackId, type, feedback)
      this.setData({ feedbackVisible: false, feedbackText: '', feedbackType: 0 })
      this._feedbackSignature = ''; this._feedbackId = ''
      wx.showToast({ title: '反馈已提交', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: (error as { statusCode?: number }).statusCode === 429 ? '提交频繁，请稍后再试' : error instanceof Error ? error.message : '提交失败，请重试', icon: 'none' })
    } finally { this.setData({ feedbackSubmitting: false }) }
  },
  onFavoriteTap() {
    const entry = this.data.entry
    if (!entry) return
    try {
      const favorited = toggleFavorite({ id: entry.id, word: entry.expression, phonetic: entry.jyutping || '' })
      this.setData({ favorited })
      wx.showToast({ title: favorited ? '已收藏到当前设备' : '已取消收藏', icon: 'none' })
    } catch (_) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }) }
  },
  onLearnTap() { this.setData({ learnExpanded: !this.data.learnExpanded }) },
  onRevealMeaning() { this.setData({ meaningRevealed: !this.data.meaningRevealed }) },
  onPracticeComplete() {
    this.setData({ practiceCompleted: true, learnExpanded: false })
    wx.showToast({ title: '已完成本次练习', icon: 'success' })
  },
  onShareAppMessage() {
    const shareId = this._shareId || createRequestId()
    track('mp_share', { entryId: this.data.id, shareId, channel: 'chat' })
    return { title: `${this.data.entry?.expression || '粤语表达'} · 粤语随手查`, path: `/pages/entry-detail/entry-detail?id=${encodeURIComponent(this.data.id)}&from=share&sid=${shareId}` }
  },
  onPreviewImage(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    const url = event.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url] })
  },
  onOpenModel(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    openModelViewer(this.data.id, event.currentTarget.dataset.url)
  },
  onReturn() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }) },
  videoContext(event: WechatMiniprogram.BaseEvent) {
    const data = event.currentTarget.dataset
    return { entryId: String(data.entryId || ''), ...(this._searchQuery ? { query: this._searchQuery, section: this._searchSection } : {}) }
  },
  onPlayAudio(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    const url = event.currentTarget.dataset.url
    const entry = this.data.entry
    if (entry) {
      let senseIndex = 0
      let exampleIndex: number | undefined
      entry.content.sections.forEach((section, index) => section.blocks.forEach(block => {
        if (block.type === 'audio' && block.url === url) senseIndex = index
        const found = block.examples?.findIndex(example => example.audioUrl === url) ?? -1
        if (found >= 0) { senseIndex = index; exampleIndex = found }
      }))
      this.audio().play(url, this.data.playingUrl, (playingUrl: string) => this.setData({ playingUrl }), { entryId: entry.id, surface: 'entry_detail', target: exampleIndex === undefined ? 'expression' : 'example', senseIndex, ...(exampleIndex === undefined ? {} : { exampleIndex }) })
    } else this.audio().play(url, this.data.playingUrl, (playingUrl: string) => this.setData({ playingUrl }))
  },
})
