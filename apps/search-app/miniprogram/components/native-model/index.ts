// Native rendering accepts model files; legacy viewer pages are resolved below.
function resolveModelSource(url: unknown): string {
  if (typeof url !== 'string' || !/^https:\/\/[^/?#]+\//i.test(url)) return ''
  if (/\.(glb|gltf)([?#]|$)/i.test(url)) return url
  return ''
}
function htmlAttribute(tag: string, name: string): string {
  const match = tag.match(new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i'))
  return (match?.[1] || match?.[2] || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
}

function absoluteModelUrl(value: string, base: string): string {
  if (/^https:\/\//i.test(value)) return value
  if (value.startsWith('//')) return 'https:' + value
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value)) return ''
  const match = base.match(/^(https:\/\/[^/?#]+)([^?#]*)/i)
  if (!match) return ''
  const path = value.startsWith('/') ? value : match[2].replace(/[^/]*$/, '') + value
  const parts: string[] = []
  const suffixIndex = path.search(/[?#]/)
  const pathname = suffixIndex < 0 ? path : path.slice(0, suffixIndex)
  for (const part of pathname.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  return match[1] + parts.join('/') + (suffixIndex < 0 ? '' : path.slice(suffixIndex))
}

function parseViewerModel(html: string, viewerUrl: string): string {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '')
  const baseTag = markup.match(/<base\b[^>]*>/i)?.[0] || ''
  const baseHref = htmlAttribute(baseTag, 'href')
  const base = baseHref ? absoluteModelUrl(baseHref, viewerUrl) : viewerUrl
  const tag = markup.match(/<model-viewer\b[^>]*>/i)?.[0] || ''
  return resolveModelSource(absoluteModelUrl(htmlAttribute(tag, 'src'), base))
}

async function loadModelSource(url: string): Promise<string> {
  const direct = resolveModelSource(url)
  if (direct) return direct
  if (!/^https:\/\/[^/?#]+\//i.test(url)) throw new Error('模型地址无效')
  // Directory-style viewer links are requested with a trailing slash so relative assets resolve correctly.
  const viewerUrl = url.replace(/^(https:\/\/[^?#]*)([?#].*)?$/i, (_, path: string, suffix: string = '') =>
    path.endsWith('/') || /\.[^/]+$/.test(path) ? path + suffix : path + '/' + suffix)
  const html = await new Promise<string>((resolve, reject) => wx.request<string>({
    url: viewerUrl,
    dataType: '其他', // 微信类型定义用“其他”表示不进行 JSON 解析。
    responseType: 'text',
    timeout: 15000,
    success(response) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error('模型展示页加载失败'))
        return
      }
      if (typeof response.data !== 'string' || response.data.length > 512000) {
        reject(new Error('模型展示页格式不受支持'))
        return
      }
      resolve(response.data)
    },
    fail: () => reject(new Error('模型地址解析失败，请检查网络后重试')),
  }))
  const source = parseViewerModel(html, viewerUrl)
  if (!source) throw new Error('展示页未提供可直接加载的 GLB/GLTF 模型')
  return source
}

type ModelState = {
  sourceVersion?: number
  mounted?: boolean
  hidden?: boolean
  inViewport?: boolean
  observer?: WechatMiniprogram.IntersectionObserver
  loadTimer?: ReturnType<typeof setTimeout>
  scrollTimer?: ReturnType<typeof setTimeout>
}

function defineModelComponent<
  D extends WechatMiniprogram.Component.DataOption,
  P extends WechatMiniprogram.Component.PropertyOption,
  M extends WechatMiniprogram.Component.MethodOption,
>(options: WechatMiniprogram.Component.Options<D, P, M, ModelState>) {
  return Component<D, P, M, ModelState>(options)
}

defineModelComponent({
  properties: {
    suspended: {
      type: Boolean,
      value: false,
      observer(value: boolean) {
        if (!this.mounted) return
        if (value) this.deactivate()
        else if (this.inViewport) this.activate()
      },
    },
    src: { type: String, observer() { if (this.mounted) this.prepare() } },
    height: { type: Number, value: 440 },
    dark: { type: Boolean, value: false },
    expandable: { type: Boolean, value: true },
    scrollOffset: { type: Number, value: 0, observer() { if (this.mounted) this.schedulePositionUpdate() } },
    viewportTop: { type: Number, value: 0, observer() { if (this.mounted && this.inViewport) { this.deactivate(); this.activate() } } },
    viewportBottom: { type: Number, value: 0, observer() { if (this.mounted && this.inViewport) { this.deactivate(); this.activate() } } },
  },
  data: { source: '', active: false, loading: true, error: '', renderWidth: 1, renderHeight: 1, displayWidth: 1, displayHeight: 220, displayLeft: 0, displayTop: 0 },
  lifetimes: {
    attached() { this.mounted = true; this.prepare() },
    ready() {
      this.mounted = true
      this.observer = this.createIntersectionObserver({ thresholds: [0, 1] })
      this.observer.relativeToViewport().observe('.model-preview', result => {
        this.inViewport = result.intersectionRatio > 0
        if (this.inViewport) this.activate()
        else this.deactivate()
      })
    },
    detached() { this.mounted = false; this.observer?.disconnect(); clearTimeout(this.loadTimer ?? 0); clearTimeout(this.scrollTimer ?? 0) },
  },
  pageLifetimes: {
    hide() { this.hidden = true; this.deactivate() },
    show() { this.hidden = false; if (this.inViewport) this.activate() },
  },
  methods: {
    async prepare() {
      this.deactivate()
      const version = (this.sourceVersion || 0) + 1
      this.sourceVersion = version
      this.setData({ source: '', loading: true, error: '' })
      try {
        const source = await loadModelSource(this.data.src)
        if (!this.mounted || this.sourceVersion !== version) return
        this.setData({ source })
        if (this.inViewport) this.activate()
      } catch (error) {
        if (!this.mounted || this.sourceVersion !== version) return
        this.setData({ loading: false, error: error instanceof Error ? error.message : '模型地址解析失败' })
      }
    },
    activate() {
      if (!this.mounted || this.hidden || this.data.suspended || this.data.active || !this.data.source || this.data.error) return
      this.createSelectorQuery().select('.model-preview').boundingClientRect(rect => {
        if (!rect || !this.mounted || this.hidden || this.data.suspended || !this.inViewport || this.data.active) return
        const info = wx.getSystemInfoSync()
        if (rect.top < this.data.viewportTop || rect.bottom > (this.data.viewportBottom || info.windowHeight)) return
        const ratio = Math.min(info.pixelRatio || 1, 2)
        this.setData({ displayLeft: rect.left, displayTop: rect.top, displayWidth: rect.width, displayHeight: rect.height, renderWidth: Math.round(rect.width * ratio), renderHeight: Math.round(rect.height * ratio), active: true, loading: true })
        this.loadTimer = setTimeout(() => this.onFailure({ detail: { message: '模型加载超时，请检查网络后重试' } }), 30000)
      }).exec()
    },
    deactivate() { clearTimeout(this.loadTimer ?? 0); if (this.data.active) this.setData({ active: false }) },
    onLoaded() { clearTimeout(this.loadTimer ?? 0); this.setData({ loading: false, error: '' }) },
    onFailure(event: { detail?: { message?: string } }) { clearTimeout(this.loadTimer ?? 0); this.setData({ active: false, loading: false, error: event.detail?.message || '模型加载失败，请重试' }) },
    schedulePositionUpdate() {
      if (this.scrollTimer) return
      this.scrollTimer = setTimeout(() => {
        this.scrollTimer = undefined
        this.updatePosition()
      }, 16)
    },
    updatePosition() {
      if (!this.mounted || this.hidden || this.data.suspended) return
      this.createSelectorQuery().select('.model-preview').boundingClientRect(rect => {
        if (!rect || !this.mounted || this.hidden || this.data.suspended) return
        const bottom = this.data.viewportBottom || wx.getSystemInfoSync().windowHeight
        const fullyVisible = rect.top >= this.data.viewportTop && rect.bottom <= bottom
        this.inViewport = rect.bottom > this.data.viewportTop && rect.top < bottom
        if (!fullyVisible) { this.deactivate(); return }
        if (this.data.active) this.setData({ displayLeft: rect.left, displayTop: rect.top })
        else this.activate()
      }).exec()
    },
    onExpand() { this.triggerEvent('expand', { url: this.data.src }) },
    onRetry() { this.prepare() },
  },
})
