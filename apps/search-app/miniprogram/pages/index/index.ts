import { applyAppearance } from '../../utils/appearance'
import { loadRandomContextScenes, type ContextScene } from '../../utils/context-game'
Page({
  data: {
    keyword: '',
    history: [] as { word: string; phonetic: string }[],
    scenes: [] as ContextScene[],
    sceneError: '',
  },

  onShow() {
    applyAppearance(this)
    this.loadHistory()
    this.loadScenes()
    const tabBar = this.getTabBar()
    if (tabBar) {
      tabBar.setData({ value: '/pages/index/index' })
    }
  },

  async loadScenes() {
    try { this.setData({ scenes: await loadRandomContextScenes(), sceneError: '' }) }
    catch (error) { this.setData({ scenes: [], sceneError: error instanceof Error ? error.message : '场景加载失败' }) }
  },

  onSearchChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ keyword: event.detail.value })
  },

  // 搜索提交与查询记录点击均经此触发。
  doSearch(word: string) {
    const normalized = word.trim()

    if (!normalized) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' })
      return
    }

    const phonetics: Record<string, string> = { '埋单': 'maai4 daan1', '唔该': 'm4 goi1', '得闲饮茶': 'dak1 haan4 jam2 caa4' }
    const history = [{ word: normalized, phonetic: phonetics[normalized] || '' }, ...this.data.history.filter(item => item.word !== normalized)].slice(0, 20)
    this.setData({ keyword: normalized, history })
    try { wx.setStorageSync('cantonese-search-history', history) } catch (error) { console.warn('History save failed', error) }
    wx.navigateTo({
      url: `/pages/search-result/search-result?keyword=${encodeURIComponent(normalized)}`,
      fail: () => wx.showToast({ title: '搜索页面打开失败，请重试', icon: 'none' }),
    })
  },

  onSearchSubmit(event?: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.doSearch(event?.detail?.value ?? this.data.keyword)
  },

  onHotWordTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { word: string }>) {
    const { word } = event.currentTarget.dataset

    if (word) {
      this.doSearch(word)
    }
  },

  loadHistory() {
    try {
      const stored: unknown = wx.getStorageSync('cantonese-search-history')
      const history = Array.isArray(stored) ? stored.filter(item => item && typeof item.word === 'string' && typeof item.phonetic === 'string').slice(0, 20) : []
      this.setData({ history })
    } catch (error) { console.warn('History load failed', error) }
  },

  onClearHistory() {
    try { wx.removeStorageSync('cantonese-search-history'); this.setData({ history: [] }) }
    catch (error) { wx.showToast({ title: '清空失败，请重试', icon: 'none' }) }
  },

  onSceneTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { scene: string }>) {
    const sceneId = event.currentTarget.dataset.scene
    if (!sceneId) return
    if (sceneId === 'travel') {
      wx.navigateToMiniProgram({
        appId: 'wx978ff75cdd9fd7f2',
        path: 'pages/question/question?scene=context&sceneId=travel&category=' + encodeURIComponent('出行问路'),
        fail: error => {
          if (error.errMsg && error.errMsg.includes('cancel')) return
          console.warn('语境填空小程序打开失败', error)
          wx.showToast({ title: '语境填空打开失败，请稍后重试', icon: 'none' })
        },
      })
      return
    }
    wx.navigateTo({ url: `/pages/context-question/context-question?sceneId=${encodeURIComponent(sceneId)}`, fail: () => wx.showToast({ title: '答题页面打开失败', icon: 'none' }) })
  },

  onSceneRetry() {
    this.loadScenes()
  },

  onDailyAudioTap() {
    wx.showToast({ title: '暂未接入该词条的粤语录音', icon: 'none' })
  },
})

export {}
