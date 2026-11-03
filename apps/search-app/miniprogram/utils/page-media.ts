import { VideoAnalytics, observeAudio, type MediaContext } from './media-analytics'

type VideoHost = {
  _mediaVisible: boolean
  _videos: VideoAnalytics | null
  videoContext(event: WechatMiniprogram.BaseEvent): MediaContext
}
function videos(host: VideoHost) { return host._videos || (host._videos = new VideoAnalytics()) }
function videoData(host: VideoHost, event: WechatMiniprogram.BaseEvent) {
  const data = event.currentTarget.dataset
  return { key: String(data.videoKey || ''), url: String(data.url || ''), context: host.videoContext(event) }
}
export const videoHandlers = {
  onVideoPlay(this: VideoHost, event: WechatMiniprogram.CustomEvent<{ currentTime?: number }>) {
    const { key, url, context } = videoData(this, event)
    if (this._mediaVisible) videos(this).start(key, url, context, 'none')
  },
  onVideoProgress(this: VideoHost, event: WechatMiniprogram.CustomEvent<{ currentTime?: number }>) {
    const { key, url, context } = videoData(this, event)
    if (this._mediaVisible) videos(this).progress(key, url, context, event.detail.currentTime || 0)
  },
  onVideoPause(this: VideoHost, event: WechatMiniprogram.CustomEvent) {
    videos(this).pause(String(event.currentTarget.dataset.videoKey || ''))
  },
  onVideoError(this: VideoHost, event: WechatMiniprogram.CustomEvent<{ errMsg?: string }>) {
    const { key, url, context } = videoData(this, event)
    if (this._mediaVisible) videos(this).error(key, url, context, 'none')
    console.warn('视频加载失败', event.detail.errMsg || '视频加载失败')
    wx.showToast({ title: '视频加载失败，请检查网络后重试', icon: 'none' })
  },
}

type AudioContext = Parameters<typeof observeAudio>[2]
export class PageAudio {
  private player?: WechatMiniprogram.InnerAudioContext
  private observation?: ReturnType<typeof observeAudio>
  stop() { this.observation?.cancel(); this.player?.stop() }
  destroy() { this.observation?.cancel(); this.player?.destroy(); this.player = undefined }
  play(url: string, playingUrl: string, update: (url: string) => void, context?: AudioContext, onDuration?: (duration: number) => void) {
    if (!url) return
    if (this.player?.src === url) {
      if (playingUrl === url) this.player.pause()
      else { this.observation?.resume(); this.player.play() }
      return
    }
    this.destroy()
    const player = wx.createInnerAudioContext()
    this.player = player
    player.volume = 1
    const reset = () => { if (this.player === player) update('') }
    player.onPlay(() => { if (this.player === player) update(url) })
    player.onPause(reset); player.onStop(reset); player.onEnded(reset)
    if (onDuration) player.onCanplay(() => {
      if (this.player === player && Number.isFinite(player.duration) && player.duration > 0) onDuration(player.duration)
    })
    player.onError(error => {
      if (this.player !== player) return
      console.warn('音频播放失败', error.errCode, error.errMsg)
      reset()
      wx.showToast({ title: '音频播放失败，请重试', icon: 'none' })
    })
    this.observation = context ? observeAudio(player, url, context) : undefined
    player.src = url
    player.play()
  }
}
