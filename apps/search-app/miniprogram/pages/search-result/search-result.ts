import { applyAppearance } from '../../utils/appearance'

type ApiEntry = {
  corpusId: number
  entryId: string
  entryName: string
  jyutping?: string | null
  meaning?: string | null
  source?: { categoryDisplayName?: string }
  category?: { primary?: { name?: string }; secondary?: { name?: string } }
  tags?: { precise?: { name: string }[]; related?: { name: string }[]; recommended?: { name: string }[] }
  assets?: { audioUrl?: string | null; videoUrl?: string | null; coverImage?: string | null; videoTranscript?: string | null }
}
type SearchResponse = { primary?: ApiEntry | null; similar?: ApiEntry[]; recommended?: ApiEntry[] }
type DictEntry = { id: string; word: string; phonetic: string; definition: string; sourceCorpus: string; categoryPrimary: string; categorySecondary: string; tags: string[] }
type MediaExample = { id: string; source: string; line: string; phonetic: string; translation: string; tags: string[]; audioUrl: string; videoUrl: string; coverImage: string }

function normalizeEntry(row: ApiEntry): DictEntry {
  return {
    id: row.entryId || String(row.corpusId), word: row.entryName || '', phonetic: row.jyutping || '',
    definition: row.meaning || '', sourceCorpus: row.source?.categoryDisplayName || '语料库',
    categoryPrimary: row.category?.primary?.name || '', categorySecondary: row.category?.secondary?.name || '',
    tags: [...(row.tags?.precise || []), ...(row.tags?.related || []), ...(row.tags?.recommended || [])].map(tag => tag.name).slice(0, 6),
  }
}
function normalizeMedia(row: ApiEntry): MediaExample {
  return {
    id: row.entryId || String(row.corpusId), source: row.source?.categoryDisplayName || '语料库',
    line: row.entryName || '', phonetic: row.jyutping || '', translation: row.meaning || row.assets?.videoTranscript || '',
    tags: [...(row.tags?.precise || []), ...(row.tags?.related || [])].map(tag => tag.name).slice(0, 3),
    audioUrl: row.assets?.audioUrl || '', videoUrl: row.assets?.videoUrl || '', coverImage: row.assets?.coverImage || '',
  }
}
function fetchEntries(keyword: string): Promise<SearchResponse> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://search.aidimsum.com/api/search/entries?q=${encodeURIComponent(keyword)}&dataset=all`,
      success: res => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && typeof res.data === 'object') resolve(res.data as SearchResponse)
        else reject(new Error('搜索失败，请稍后重试'))
      },
      fail: () => reject(new Error('网络连接失败，请稍后重试')),
    })
  })
}

let audioPlayer: WechatMiniprogram.InnerAudioContext | undefined
let searchSerial = 0
Page({
  data: {
    keyword: '', searchedKeyword: '',
    entry: null as DictEntry | null, primaryMedia: null as MediaExample | null, relatedEntries: [] as DictEntry[], mediaExamples: [] as MediaExample[],
    loading: false, error: '', sharePickerVisible: false,
  },
  onShow() { applyAppearance(this) },
  onUnload() { audioPlayer?.destroy(); audioPlayer = undefined },
  onLoad(query: { keyword?: string }) {
    const keyword = query.keyword ? decodeURIComponent(query.keyword) : ''
    this.setData({ keyword })
    if (keyword) this.search(keyword)
  },
  async search(keyword: string) {
    const serial = ++searchSerial
    this.setData({ keyword, loading: true, error: '', entry: null, primaryMedia: null, relatedEntries: [], mediaExamples: [] })
    try {
      const response = await fetchEntries(keyword)
      if (serial !== searchSerial) return
      const rows = [...(response.similar || []), ...(response.recommended || [])]
      const seen = new Set<string>()
      const mediaExamples = rows.filter(row => {
        const key = row.entryId || String(row.corpusId)
        if (seen.has(key)) return false
        seen.add(key)
        return Boolean(row.assets?.audioUrl || row.assets?.videoUrl || row.assets?.coverImage)
      }).map(normalizeMedia)
      const primary = response.primary
      const primaryMedia = primary && (primary.assets?.audioUrl || primary.assets?.videoUrl || primary.assets?.coverImage) ? normalizeMedia(primary) : null
      this.setData({ searchedKeyword: keyword, entry: primary ? normalizeEntry(primary) : null, primaryMedia, relatedEntries: (response.similar || []).map(normalizeEntry), mediaExamples, loading: false })
    } catch (error) {
      if (serial === searchSerial) this.setData({ loading: false, error: error instanceof Error ? error.message : '搜索失败' })
    }
  },
  onSearchChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ keyword: event.detail.value }) },
  onSearchSubmit(event?: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const keyword = (event?.detail?.value ?? this.data.keyword).trim()
    if (!keyword) { wx.showToast({ title: '请输入搜索关键词', icon: 'none' }); return }
    this.search(keyword)
  },
  onClearTap() { this.setData({ keyword: '' }) },
  onShareTap() { this.setData({ sharePickerVisible: true }) },
  onShareClose() { this.setData({ sharePickerVisible: false }) },
  onShareContentTap() {},
  onCopyLinkTap() {
    const keyword = this.data.searchedKeyword || this.data.keyword
    const url = `https://search.aidimsum.com/search?q=${encodeURIComponent(keyword)}&dataset=all&mode=entry`
    wx.setClipboardData({ data: url, success: () => { this.onShareClose(); wx.showToast({ title: '链接已复制', icon: 'success' }) }, fail: () => wx.showToast({ title: '复制失败', icon: 'none' }) })
  },
  onShareAppMessage() {
    const keyword = this.data.searchedKeyword || this.data.keyword
    this.onShareClose()
    return { title: `${keyword} · 粤语随手查`, path: `/pages/search-result/search-result?keyword=${encodeURIComponent(keyword)}` }
  },
  onCopyIdTap() {
    const id = this.data.entry?.id
    if (id) wx.setClipboardData({ data: id, success: () => wx.showToast({ title: '已复制词条 ID', icon: 'none' }), fail: () => wx.showToast({ title: '复制失败', icon: 'none' }) })
  },
  onRelatedTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { word: string }>) {
    const word = event.currentTarget.dataset.word
    if (word) this.search(word)
  },
  onRefreshRelated() { if (this.data.searchedKeyword) this.search(this.data.searchedKeyword) },
  onRefreshMedia() { if (this.data.searchedKeyword) this.search(this.data.searchedKeyword) },
  onPlayAudio(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    const url = event.currentTarget.dataset.url
    if (!url) return
    audioPlayer?.destroy()
    audioPlayer = wx.createInnerAudioContext()
    audioPlayer.src = url
    audioPlayer.onError(() => wx.showToast({ title: '音频播放失败', icon: 'none' }))
    audioPlayer.play()
  },
  onPreviewImage(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { url: string }>) {
    const url = event.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url], fail: () => wx.showToast({ title: '图片打开失败', icon: 'none' }) })
  },
})
export {}
