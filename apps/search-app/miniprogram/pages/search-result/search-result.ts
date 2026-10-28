import { saveSearchHistory } from '../../utils/search-history'
import { openModelViewer } from '../../utils/model-viewer'
import { applyAppearance } from '../../utils/appearance'
import { createRequestId } from '../../utils/identity'
import { fetchSearch, normalizeEntry, type DisplayEntry } from '../../utils/search-v2'

function appendEntries(previous: DisplayEntry[], incoming: DisplayEntry[]): DisplayEntry[] {
  const seen = new Set(previous.map(entry => entry.id))
  return [...previous, ...incoming.filter(entry => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })]
}

let audioPlayer: WechatMiniprogram.InnerAudioContext | undefined
let searchSerial = 0
let filterSerial = 0
Page({
  data: { modelScrollOffset: 0, modelViewportTop: 0, modelViewportBottom: 0,
    keyword: '', searchedKeyword: '', mediaType: '', relatedFiltered: false,
    mediaFilters: [{ value: '', label: '全部' }, { value: 'text', label: '纯文本' }, { value: 'audio', label: '音频' }, { value: 'video', label: '视频' }, { value: 'image', label: '图片' }, { value: 'model3d', label: '3D 模型' }],
    direct: [] as DisplayEntry[], related: [] as DisplayEntry[], recommended: [] as DisplayEntry[], requestId: '',
    similarCursor: null as string | null, recommendedCursor: null as string | null,
    primaryCorpusId: null as number | null, semanticStatus: '', primaryStatus: '', semanticLoading: false,
    similarLoading: false, recommendedLoading: false, similarError: '', recommendedError: '',
    playingUrl: '', audioTimes: {} as Record<string, string>,
    loading: false, error: '',
  },
  onReady() { this.updateModelViewport() },
  onResize() { this.updateModelViewport() },
  updateModelViewport() {
    this.createSelectorQuery().select('.result-scroll').boundingClientRect(rect => {
      if (!rect || Array.isArray(rect)) return
      const info = wx.getSystemInfoSync()
      const tabHeight = 112 * info.windowWidth / 750 + (info.safeArea ? info.screenHeight - info.safeArea.bottom : 0)
      this.setData({ modelViewportTop: rect.top, modelViewportBottom: rect.bottom - tabHeight })
    }).exec()
  },
  onResultScroll(event: WechatMiniprogram.CustomEvent<{ scrollTop: number }>) {
    this.setData({ modelScrollOffset: event.detail.scrollTop })
  },
  onShow() { applyAppearance(this) },
  onHide() { audioPlayer?.stop(); this.setData({ playingUrl: '' }) },
  onUnload() { ++searchSerial; audioPlayer?.destroy(); audioPlayer = undefined },
  onLoad(query: { keyword?: string }) {
    const keyword = query.keyword ? decodeURIComponent(query.keyword) : ''
    this.setData({ keyword })
    if (keyword) this.search(keyword)
  },
  async search(keyword: string, retry = false) {
    keyword = keyword.trim()
    if (!keyword || keyword.length > 100) {
      wx.showToast({ title: '请输入 1–100 字符的关键词', icon: 'none' })
      return
    }
    if (!retry) {
      try { saveSearchHistory(keyword) } catch (error) { console.warn('History save failed', error) }
    }
    const serial = ++searchSerial
    ++filterSerial
    const requestId = retry && this.data.requestId ? this.data.requestId : createRequestId()
    audioPlayer?.stop()
    this.setData({ playingUrl: '' })
    this.setData({ keyword, searchedKeyword: keyword, requestId, mediaType: '', relatedFiltered: false, loading: true, error: '', direct: [], related: [], recommended: [], similarCursor: null, recommendedCursor: null, primaryCorpusId: null, semanticStatus: '', primaryStatus: '', semanticLoading: false, similarLoading: false, recommendedLoading: false, similarError: '', recommendedError: '' })
    try {
      const response = await fetchSearch(keyword, requestId)
      if (serial !== searchSerial) return
      this.setData({ direct: response.primary ? [normalizeEntry(response.primary)] : [], related: appendEntries([], response.similar.map(normalizeEntry)), recommended: appendEntries([], response.recommended.map(normalizeEntry)), primaryCorpusId: response.primary?.corpusId ?? null, similarCursor: response.cursors.similarNext, recommendedCursor: response.cursors.recommendedNext, primaryStatus: response.sectionStatus.primary, semanticStatus: response.sectionStatus.semantic, loading: false })
    } catch (_) {
      if (serial === searchSerial) this.setData({ loading: false, error: '搜索暂时失败，请重试' })
    }
  },
  onRetry() { this.search(this.data.searchedKeyword, true) },
  async onMediaFilterTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { value: string }>) {
    const mediaType = event.currentTarget.dataset.value
    if (this.data.loading || mediaType === this.data.mediaType || !this.data.mediaFilters.some(filter => filter.value === mediaType)) return
    ++filterSerial
    audioPlayer?.stop()
    this.setData({ mediaType, relatedFiltered: true, related: [], similarCursor: null, semanticStatus: 'loading', semanticLoading: false, similarLoading: false, similarError: '', playingUrl: '' })
    await this.onSemanticRetry()
  },
  async onSemanticRetry() {
    if (this.data.semanticLoading || this.data.loading) return
    const serial = searchSerial
    const filterVersion = filterSerial
    const relatedOnly = this.data.relatedFiltered
    this.setData({ semanticLoading: true })
    try {
      const response = await fetchSearch(this.data.searchedKeyword, this.data.requestId, { semanticRetry: true, ...(relatedOnly ? { part: 'similar' as const, mediaType: this.data.mediaType } : {}), primaryCorpusId: this.data.primaryCorpusId })
      if (serial !== searchSerial || filterVersion !== filterSerial) return
      this.setData({ related: appendEntries(this.data.related, response.similar.map(normalizeEntry)), similarCursor: response.cursors.similarNext, semanticStatus: response.sectionStatus.semantic,
        ...(!relatedOnly ? { recommended: appendEntries(this.data.recommended, response.recommended.map(normalizeEntry)), recommendedCursor: response.cursors.recommendedNext } : {}),
      })
    } catch (_) { if (serial === searchSerial && filterVersion === filterSerial) this.setData({ semanticStatus: 'error' }) }
    finally { if (serial === searchSerial && filterVersion === filterSerial) this.setData({ semanticLoading: false }) }
  },
  async onLoadMore(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { part: string; replace?: boolean }>) {
    const part = event.currentTarget.dataset.part
    if (part !== 'similar' && part !== 'recommended') return
    const cursor = part === 'similar' ? this.data.similarCursor : this.data.recommendedCursor
    if (this.data.loading || (part === 'similar' && this.data.semanticLoading) || this.data[`${part}Loading`] || cursor === null) return
    const serial = searchSerial
    const filterVersion = filterSerial
    const replace = Boolean(event.currentTarget.dataset.replace)
    this.setData({ [`${part}Loading`]: true, [`${part}Error`]: '' })
    try {
      const response = await fetchSearch(this.data.searchedKeyword, this.data.requestId, { part, cursor, mediaType: part === 'similar' ? this.data.mediaType : undefined, primaryCorpusId: this.data.primaryCorpusId })
      if (serial !== searchSerial || (part === 'similar' && filterVersion !== filterSerial)) return
      if (response.sectionStatus.semantic === 'error') throw new Error('分区加载失败')
      const key = part === 'similar' ? 'related' : 'recommended'
      this.setData({ [key]: appendEntries(replace ? [] : this.data[key], response[part].map(normalizeEntry)), [`${part}Cursor`]: part === 'similar' ? response.cursors.similarNext : response.cursors.recommendedNext, semanticStatus: response.sectionStatus.semantic })
    } catch (_) { if (serial === searchSerial && (part !== 'similar' || filterVersion === filterSerial)) this.setData({ [`${part}Error`]: '加载失败，点击重试' }) }
    finally { if (serial === searchSerial && (part !== 'similar' || filterVersion === filterSerial)) this.setData({ [`${part}Loading`]: false }) }
  },
  onSearchChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ keyword: event.detail.value }) },
  onSearchSubmit(event?: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const keyword = (event?.detail?.value ?? this.data.keyword).trim()
    if (!keyword) { wx.showToast({ title: '请输入搜索关键词', icon: 'none' }); return }
    this.search(keyword)
  },
  onClearTap() { this.setData({ keyword: '' }) },
  onShareAppMessage() {
    const keyword = this.data.searchedKeyword || this.data.keyword
    return { title: `${keyword} · 粤语随手查`, path: `/pages/search-result/search-result?keyword=${encodeURIComponent(keyword)}` }
  },
  onOpenModel(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { id: string; url: string }>) {
    openModelViewer(event.currentTarget.dataset.id, event.currentTarget.dataset.url)
  },
  onUsageTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { id: string }>) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/entry-detail/entry-detail?id=${encodeURIComponent(id)}`, fail: () => wx.showToast({ title: '详情页面打开失败', icon: 'none' }) })
  },
  onVideoError(event: WechatMiniprogram.CustomEvent<{ errMsg?: string }>) {
    const message = event.detail.errMsg || '视频加载失败'
    console.warn('视频加载失败', message)
    wx.showToast({ title: '视频加载失败，请检查网络后重试', icon: 'none' })
  },
  onPlayAudio(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    const url = event.currentTarget.dataset.url
    if (!url) return
    if (audioPlayer && audioPlayer.src === url) {
      if (this.data.playingUrl === url) { audioPlayer.pause(); return }
      this.setData({ playingUrl: url })
      audioPlayer.play()
      return
    }
    audioPlayer?.destroy()
    const player = wx.createInnerAudioContext()
    audioPlayer = player
    player.src = url
    this.setData({ playingUrl: url })
    const reset = () => { if (audioPlayer === player) this.setData({ playingUrl: '' }) }
    player.onPause(reset)
    player.onStop(reset)
    player.onEnded(reset)
    player.onCanplay(() => {
      if (audioPlayer !== player || !Number.isFinite(player.duration) || player.duration <= 0) return
      const seconds = Math.ceil(player.duration)
      this.setData({ audioTimes: { ...this.data.audioTimes, [url]: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` } })
    })
    player.onError(() => { reset(); wx.showToast({ title: '音频播放失败，请重试', icon: 'none' }) })
    player.play()
  },
  onPreviewImage(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    const url = event.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url], fail: () => wx.showToast({ title: '图片打开失败', icon: 'none' }) })
  },
})
export {}
