import type { DisplayEntry, ContentBlock } from './search-v2'

// Keep review-app's block names; Search additionally exposes normalized usage/media blocks.
export const blockLabels: Record<string, string> = {
  phrase: '词组', sentence: '例句', definition: '解释', introduction: '介绍',
  classification: '分类', emotion: '情感', other: '其他', usage: '用法说明',
  subtitle: '字幕', transcript: '文字稿', transcription: '转写', example: '例句',
  audio: '音频', video: '视频', image: '图片', model3d: '3D 模型', voxel: '体素模型',
}
export function buildDetailContent(entry: DisplayEntry) {
  const sections = entry.content.sections.map(section => {
    const firstAudio = section.blocks.findIndex(block => block.type === 'audio' && block.url)
    const visible = section.blocks.filter((block, index) => index !== firstAudio && block.type !== 'introduction' && Boolean(block.text || block.url || block.examples?.length))
    return {
      jyutping: section.jyutping,
      audio: firstAudio >= 0 ? section.blocks[firstAudio].url : null,
      blocks: visible.map((block, index) => ({ ...block,
        label: blockLabels[block.type] || '其他',
        showLabel: index === 0 || visible[index - 1].type !== block.type,
      })),
    }
  }).filter(section => section.jyutping || section.audio || section.blocks.length)
  const blocks: ContentBlock[] = entry.content.sections.flatMap(section => section.blocks)
  const containsText = (text: string | null | undefined) => Boolean(text && blocks.some(block => block.text === text))
  const containsMedia = (type: string, url: string | null) => Boolean(url && blocks.some(block => block.type === type && block.url === url))
  return {
    sections,
    heroAudio: sections.length === 1 && sections[0].audio ? sections[0].audio : containsMedia('audio', entry.assets.audioUrl) ? '' : entry.assets.audioUrl || '',
    topJyutping: entry.jyutping && !sections.some(section => section.jyutping === entry.jyutping) ? entry.jyutping : '',
    topMeaning: containsText(entry.meaning) ? '' : entry.meaning || '',
    topUsage: containsText(entry.content.usageNotes) ? '' : entry.content.usageNotes || '',
    topAudio: containsMedia('audio', entry.assets.audioUrl) ? '' : entry.assets.audioUrl || '',
    topVideo: containsMedia('video', entry.assets.videoUrl) ? '' : entry.assets.videoUrl || '',
    topImage: containsMedia('image', entry.assets.coverImage) ? '' : entry.assets.coverImage || '',
    topModel: containsMedia('model3d', entry.assets.model3dUrl) || containsMedia('voxel', entry.assets.model3dUrl) ? '' : entry.assets.model3dUrl || '',
  }
}
