import { trackPage } from '../../utils/analytics'
import { fetchEntry } from '../../utils/search-v2'
import { getDailyRefreshDelay, invalidateDailyEntry, loadDailyEntry } from '../../utils/daily-entry'
import { readSearchHistory, saveSearchHistory } from '../../utils/search-history'
import { applyAppearance } from '../../utils/appearance'
import { loadRandomContextScenes, type ContextScene } from '../../utils/context-scenes'
Page({
  data: {
    isLoggedIn: false,
    keyword: '',
    daily: null as { id: string; expression: string; phonetic: string; meaning: string; note: string; audio: string } | null,
    dailyTags: [] as string[],
    dailyLoading: true,
    dailyError: '',
    dailyPlaying: false,
    dailyLabel: '今日一句',
    dailyUnavailable: false,
    history: [] as { word: string; phonetic: string }[],
    scenes: [] as ContextScene[],
    sceneError: '',
    scenesLoading: true,
    scenePlaceholders: [0, 1, 2],
  },

  onShow() { trackPage(this);
    this._dailyVisible = true
    applyAppearance(this)
    this.setData({ isLoggedIn: !!getApp<IAppOption>().globalData.userInfo })
    this.loadHistory()
    this.loadScenes()
    this.loadDaily()
    const tabBar = this.getTabBar()
    if (tabBar) {
      tabBar.setData({ value: '/pages/index/index' })
    }
  },

  _loadingScenes: false,
  async loadScenes() {
    if (this._loadingScenes) return
    this._loadingScenes = true
    this.setData({ scenesLoading: true, sceneError: '' })
    try { this.setData({ scenes: await loadRandomContextScenes(), sceneError: '' }) }
    catch (error) { this.setData({ scenes: [], sceneError: error instanceof Error ? error.message : '场景加载失败' }) }
    finally { this._loadingScenes = false; this.setData({ scenesLoading: false }) }
  },

  onSearchChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ keyword: event.detail.value })
  },

  // 搜索提交与查询记录点击均经此触发。
  doSearch(word: string, origin = 'search_box') {
    const normalized = word.trim()

    if (!normalized || normalized.length > 100) {
      wx.showToast({ title: '请输入 1–100 字符的关键词', icon: 'none' })
      return
    }

    this.setData({ keyword: normalized })
    try { this.setData({ history: saveSearchHistory(normalized) }) } catch (error) { console.warn('History save failed', error) }
    wx.navigateTo({
      url: `/pages/search-result/search-result?keyword=${encodeURIComponent(normalized)}&origin=${origin}`,
      fail: () => wx.showToast({ title: '搜索页面打开失败，请重试', icon: 'none' }),
    })
  },

  onSearchSubmit(event?: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.doSearch(event?.detail?.value ?? this.data.keyword)
  },

  onHotWordTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { word: string }>) {
    const { word } = event.currentTarget.dataset

    if (word) {
      this.doSearch(word, 'history')
    }
  },

  loadHistory() {
    try {
      this.setData({ history: readSearchHistory() })
    } catch (error) { console.warn('History load failed', error) }
  },

  onClearHistory() {
    try { wx.removeStorageSync('cantonese-search-history'); this.setData({ history: [] }) }
    catch (error) { wx.showToast({ title: '清空失败，请重试', icon: 'none' }) }
  },

  onSceneTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { scene: string }>) {
    const sceneId = event.currentTarget.dataset.scene
    if (!sceneId) return
    const scene = this.data.scenes.find(item => item.id === sceneId)
    if (!scene) return
    wx.navigateToMiniProgram({
      appId: 'wx978ff75cdd9fd7f2',
      path: `pages/question/question?scene=context&sceneId=${encodeURIComponent(scene.id)}&category=${encodeURIComponent(scene.scene)}`,
      fail: error => {
        if (error.errMsg && error.errMsg.includes('cancel')) return
        wx.showToast({ title: '语境填空打开失败，请稍后重试', icon: 'none' })
      },
    })
  },

  onSceneRetry() {
    this.loadScenes()
  },

  _dailyPending: false,
  _dailyVisible: false,
  _dailyTimer: null as ReturnType<typeof setTimeout> | null,
  _dailyAudio: null as WechatMiniprogram.InnerAudioContext | null,
  scheduleDailyRefresh(expiresAt?: string) {
    if (this._dailyTimer) clearTimeout(this._dailyTimer)
    this._dailyTimer = null
    if (!this._dailyVisible) return
    this._dailyTimer = setTimeout(() => {
      this._dailyTimer = null
      this.loadDaily()
    }, getDailyRefreshDelay(expiresAt))
  },
  async loadDaily(backgroundCheck: unknown = false) {
    if (this._dailyPending) return
    if (this._dailyTimer) clearTimeout(this._dailyTimer)
    this._dailyTimer = null
    this._dailyPending = true
    this.setData({ dailyLoading: !this.data.daily && !this.data.dailyUnavailable })
    try {
      const result = await loadDailyEntry(backgroundCheck === true)
      if (result.error === 'SKIP') return
      if (!result.error && !result.offline) this.scheduleDailyRefresh(result.response?.expiresAt)
      const entry = result.response?.entry
      const sense = entry?.senses[0]
      if (this.data.daily?.id !== entry?.id) this.stopDailyAudio()
      this.setData({ daily: entry ? {
        id: entry.id, expression: entry.expression,
        phonetic: sense?.jyutping || '',
        meaning: sense?.meaning || '',
        note: sense?.usageNotes || '',
        audio: sense?.audio || '',
      } : null, dailyError: result.error, dailyUnavailable: result.unavailable,
        dailyLabel: result.offline ? `离线内容（${result.response?.date}）` : '今日一句' })
      if (entry && result.response) this.loadDailyTags(entry.id, result.response.expiresAt, result.offline)
      else this.setData({ dailyTags: [] })
    } finally {
      this._dailyPending = false
      this.setData({ dailyLoading: false })
    }
  },
  _dailyTagId: '',
  async loadDailyTags(id: string, expiresAt: string, offline: boolean) {
    if (this._dailyTagId === id) return
    this._dailyTagId = id
    this.setData({ dailyTags: [] })
    const key = `search-app:daily-entry-tags:${wx.getAccountInfoSync().miniProgram.envVersion}:${id}`
    try {
      const saved = wx.getStorageSync(key)
      if (saved?.expiresAt === expiresAt && Array.isArray(saved.tags)) {
        this.setData({ dailyTags: saved.tags }); return
      }
      if (offline) { this._dailyTagId = ''; return }
      const detail = await fetchEntry(id)
      if (this.data.daily?.id !== id) return
      this.setData({ dailyTags: detail.primaryTags })
      wx.setStorageSync(key, { expiresAt, tags: detail.primaryTags })
    } catch (error) {
      this._dailyTagId = ''
      if ((error as { statusCode?: number }).statusCode === 404) {
        invalidateDailyEntry(id)
        if (this.data.daily?.id === id) this.loadDaily()
      }
    }
  },
  onDailyTap() {
    if (this.data.daily) wx.navigateTo({ url: `/pages/entry-detail/entry-detail?id=${encodeURIComponent(this.data.daily.id)}` })
  },
  stopDailyAudio() {
    if (this._dailyAudio) this._dailyAudio.stop()
    this.setData({ dailyPlaying: false })
  },
  onHide() { this._dailyVisible = false; this.stopDailyAudio(); if (this._dailyTimer) clearTimeout(this._dailyTimer); this._dailyTimer = null },
  onUnload() {
    this._dailyVisible = false
    if (this._dailyTimer) clearTimeout(this._dailyTimer)
    this._dailyTimer = null
    if (this._dailyAudio) this._dailyAudio.destroy()
    this._dailyAudio = null
  },
  onDailyAudioTap() {
    const url = this.data.daily?.audio
    if (!url) return
    if (this.data.dailyPlaying) { this.stopDailyAudio(); return }
    if (!this._dailyAudio) {
      const audio = wx.createInnerAudioContext()
      audio.onPlay(() => this.setData({ dailyPlaying: true }))
      audio.onPause(() => this.setData({ dailyPlaying: false }))
      audio.onEnded(() => this.setData({ dailyPlaying: false }))
      audio.onStop(() => this.setData({ dailyPlaying: false }))
      audio.onError(() => {
        this.setData({ dailyPlaying: false })
        wx.showToast({ title: '音频播放失败，请重试', icon: 'none' })
      })
      this._dailyAudio = audio
    }
    if (this._dailyAudio.src !== url) this._dailyAudio.src = url
    this._dailyAudio.play()
  },
})

export {}
