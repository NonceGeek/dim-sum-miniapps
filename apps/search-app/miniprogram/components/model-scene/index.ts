type ModelVector = { x: number; y: number; z: number }
type ModelScene = {
  getElementById(id: string): {
    getComponent(name: 'gltf'): {
      calcTotalBoundBox(): { center: ModelVector; size: ModelVector }
    }
  }
}
type SceneState = { disposed?: boolean; fitted?: boolean; scene?: ModelScene | null }

function defineSceneComponent<
  D extends WechatMiniprogram.Component.DataOption,
  P extends WechatMiniprogram.Component.PropertyOption,
  M extends WechatMiniprogram.Component.MethodOption,
>(options: WechatMiniprogram.Component.Options<D, P, M, SceneState>) {
  return Component<D, P, M, SceneState>(options)
}

defineSceneComponent({
  properties: { source: String, background: { type: String, value: '0.96 0.97 0.99 1' } },
  data: { assetSource: '', clearColor: '0.96 0.97 0.99 1', loaded: false, modelPosition: '0 0 0', modelScale: '1 1 1' },
  observers: {
    source(value: string) { this.setData({ assetSource: value }) },
    background(value: string) { if (value) this.setData({ clearColor: value }) },
  },
  lifetimes: { detached() { this.disposed = true; this.scene = null } },
  methods: {
    onSceneReady({ detail }: { detail: { value: ModelScene } }) { this.scene = detail.value },
    onAssetsLoaded() { if (!this.disposed && this.data.assetSource) this.setData({ loaded: true }) },
    onAssetError() { if (!this.disposed) this.triggerEvent('failure', { message: '模型资源加载失败，请重试' }) },
    onModelLoaded() {
      if (this.disposed || !this.scene || this.fitted) return
      this.fitted = true
      try {
        const bounds = this.scene.getElementById('model').getComponent('gltf').calcTotalBoundBox()
        const extent = Math.max(bounds.size.x, bounds.size.y, bounds.size.z)
        if (!Number.isFinite(extent) || extent <= 0) throw new Error('Invalid model bounds')
        const scale = 2.2 / extent
        const center = bounds.center
        wx.nextTick(() => {
          if (this.disposed) return
          this.setData({ modelScale: `${scale} ${scale} ${scale}`, modelPosition: `${-center.x * scale} ${-center.y * scale} ${-center.z * scale}` })
          this.triggerEvent('loaded')
        })
      } catch (error) {
        this.triggerEvent('failure', { message: '模型无法正确显示，请重试' })
        console.warn('模型取景失败', error)
      }
    },
  },
})
