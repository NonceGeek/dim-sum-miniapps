import { trackPage } from '../../utils/analytics'
import { decodeModelResource } from '../../utils/model-viewer'
import { fetchEntry } from '../../utils/search-v2'
import { applyAppearance } from '../../utils/appearance'
Page({
  data: { modelScrollOffset: 0, modelViewportTop: 0, modelViewportBottom: 0, id: '', resource: '', url: '', loading: true, error: '' },
  onLoad(options: { id?: string; resource?: string }) {
    this.setData({ id: options.id || '', resource: decodeModelResource(options.resource || '') })
    this.loadModel()
  },
  onPageScroll(event: WechatMiniprogram.Page.IPageScrollOption) { this.setData({ modelScrollOffset: event.scrollTop }) },
  onShow() { trackPage(this); applyAppearance(this) },
  async loadModel() {
    this.setData({ loading: true, error: '', url: '' })
    try {
      const entry = await fetchEntry(this.data.id)
      const resources = [entry.assets.model3dUrl, ...entry.content.sections.flatMap(section => section.blocks.filter(block => block.type === 'model3d' || block.type === 'voxel').map(block => block.url))].filter(Boolean)
      const url = this.data.resource || entry.assets.model3dUrl || ''
      if (!resources.includes(url)) throw new Error('该模型资源暂不可用')
      this.setData({ url, loading: false })
    } catch (error) {
      this.setData({ loading: false, error: (error as { statusCode?: number }).statusCode === 404 ? '该内容暂不可用' : error instanceof Error ? error.message : '模型加载失败，请重试' })
    }
  },
})
