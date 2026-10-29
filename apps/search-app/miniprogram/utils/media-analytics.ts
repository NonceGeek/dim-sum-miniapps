import { track, resourcePath } from './analytics'
import { createRequestId } from './identity'
export type MediaContext = { entryId: string; query?: string; section?: string }
type ErrorType = 'timeout' | 'network' | 'resource_unavailable' | 'unsupported' | 'unknown'
export function mediaError(code?: number): ErrorType {
  if (code === 10002 || code === 10003) return 'network'
  if (code === 10004) return 'resource_unavailable'
  if (code === 10001) return 'unsupported'
  return 'unknown'
}
export function observeAudio(player: WechatMiniprogram.InnerAudioContext, url: string, context: MediaContext & { surface: 'search_result' | 'entry_detail'; target: 'expression' | 'example'; senseIndex: number; exampleIndex?: number }) {
  const audioId = resourcePath(url)
  if (!audioId || audioId.length > 300 || context.senseIndex > 100 || (context.target === 'example' && (context.exampleIndex === undefined || context.exampleIndex > 2))) return { cancel() {}, resume() {} }
  const props = { ...context, audioId, playSessionId: createRequestId() }
  let loadAttemptId = createRequestId()
  let played = false
  let failed = false
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const stopTimer = () => { if (timer) clearTimeout(timer); timer = undefined }
  const fail = (errorType: ErrorType) => {
    if (played || failed || cancelled) return
    failed = true; stopTimer()
    track('audio_error', { ...props, loadAttemptId, errorType })
  }
  const wait = () => { stopTimer(); timer = setTimeout(() => fail('timeout'), 15000) }
  wait()
  player.onPlay(() => {
    if (played || cancelled) return
    played = true; stopTimer(); track('audio_play', props)
  })
  player.onError(error => fail(mediaError(error.errCode)))
  const cancel = () => { cancelled = true; stopTimer() }
  player.onStop(cancel); player.onEnded(cancel)
  return { cancel, resume() {
    if (played) return
    if (failed || cancelled) { loadAttemptId = createRequestId(); failed = false; cancelled = false; wait() }
  } }
}

type VideoState = { context: MediaContext; videoId: string; playSessionId: string; loadAttemptId: string; started: number; played: boolean; failed: boolean; timer?: ReturnType<typeof setTimeout>; fallbackType: 'text' | 'text_audio' | 'none' }
export class VideoAnalytics {
  private states = new Map<string, VideoState>()
  private state(key: string, url: string, context: MediaContext, fallbackType: VideoState['fallbackType']) {
    let state = this.states.get(key)
    if (!state || state.failed) {
      state = { context, videoId: resourcePath(url), playSessionId: state?.playSessionId || createRequestId(), loadAttemptId: createRequestId(), started: Date.now(), played: false, failed: false, fallbackType }
      this.states.set(key, state)
    }
    return state
  }
  start(key: string, url: string, context: MediaContext, fallbackType: VideoState['fallbackType']) {
    const state = this.state(key, url, context, fallbackType)
    if (!state.played && !state.timer) state.timer = setTimeout(() => this.failure(key, 'timeout'), 15000)
  }
  progress(key: string, url: string, context: MediaContext, currentTime: number) {
    if (!(currentTime > 0)) return
    const state = this.state(key, url, context, 'none')
    if (state.played || state.failed || !state.videoId) return
    state.played = true; clearTimeout(state.timer ?? 0)
    track('video_play', { ...state.context, videoId: state.videoId, playSessionId: state.playSessionId, surface: 'miniprogram' })
  }
  error(key: string, url: string, context: MediaContext, fallbackType: VideoState['fallbackType']) {
    if (!this.states.has(key)) this.state(key, url, context, fallbackType)
    this.failure(key, 'unknown')
  }
  private failure(key: string, errorType: ErrorType) {
    const state = this.states.get(key)
    if (!state || state.played || state.failed || !state.videoId) return
    state.failed = true; clearTimeout(state.timer ?? 0)
    track('video_load_failed', { ...state.context, videoId: state.videoId, playSessionId: state.playSessionId, loadAttemptId: state.loadAttemptId, surface: 'miniprogram', errorType, loadElapsedMs: Math.max(0, Date.now() - state.started), fallbackType: state.fallbackType })
  }
  pause(key: string) { const state = this.states.get(key); if (state) { clearTimeout(state.timer ?? 0); state.timer = undefined } }
  suspend() { for (const key of this.states.keys()) this.pause(key) }
  clear() { this.suspend(); this.states.clear() }
}
