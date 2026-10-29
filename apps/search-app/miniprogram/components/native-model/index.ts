// The API must provide the model file URL; viewer pages are not model assets.
function resolveModelSource(url: unknown): string {
  if (typeof url !== 'string' || !/^https:\/\/[^/?#]+\//i.test(url)) return ''
  if (/\.(glb|gltf)([?#]|$)/i.test(url)) return url
  return ''
}
type ModelState = {
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
      this.prepare()
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
    prepare() {
      this.deactivate()
      const source = resolveModelSource(this.data.src)
      this.setData({ source, loading: true, error: source ? '' : '该资源暂未提供可用的原生 3D 模型' })
      if (this.inViewport) this.activate()
    },
    activate() {
      if (!this.mounted || this.hidden || this.data.active || !this.data.source || this.data.error) return
      this.createSelectorQuery().select('.model-preview').boundingClientRect(rect => {
        if (!rect || !this.mounted || this.hidden || !this.inViewport || this.data.active) return
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
      if (!this.mounted || this.hidden) return
      this.createSelectorQuery().select('.model-preview').boundingClientRect(rect => {
        if (!rect || !this.mounted || this.hidden) return
        const bottom = this.data.viewportBottom || wx.getSystemInfoSync().windowHeight
        const fullyVisible = rect.top >= this.data.viewportTop && rect.bottom <= bottom
        this.inViewport = rect.bottom > this.data.viewportTop && rect.top < bottom
        if (!fullyVisible) { this.deactivate(); return }
        if (this.data.active) this.setData({ displayLeft: rect.left, displayTop: rect.top })
        else this.activate()
      }).exec()
    },
    onExpand() { this.triggerEvent('expand', { url: this.data.src }) },
    onRetry() { this.deactivate(); this.setData({ error: '', loading: true }); this.activate() },
  },
})
