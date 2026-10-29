import { API } from '../config/api'
import { createRequestId, getAnonymousId } from './identity'

type Props = Record<string, string | number | boolean | undefined>
type Event = { name: string; props: Props; time: string; path: string; locale: string }
type Envelope = { anonymousId: string; sessionId: string; source: 'miniprogram'; app: 'search-app'; events: Event[] }
let sessionId = ''
let hiddenAt: number | null = null
let scene = 0
let landing = true
let lastPage: object | null = null
let queue: Event[] = []
let envelope: Omit<Envelope, 'events'> | null = null
let token = ''
let timer: ReturnType<typeof setTimeout> | undefined
let foreground = true
function accessToken(): string { return getApp<IAppOption>().globalData.accessToken || '' }
function bytes(value: unknown): number { return encodeURIComponent(JSON.stringify(value)).replace(/%[0-9A-F]{2}|[^%]/g, 'x').length }
export function flushAnalytics() {
  if (timer) clearTimeout(timer)
  timer = undefined
  const events = queue
  queue = []
  if (!events.length || !envelope) return
  const data = { ...envelope, events }
  try {
    wx.request({ url: API.analyticsUrl, method: 'POST', timeout: 5000,
      header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      data, success() {}, fail() {},
    })
  } catch (_) { /* Analytics never interrupts a business operation. */ }
}
export function analyticsShow(options: { scene?: number } = {}) {
  foreground = true
  if (!sessionId || (hiddenAt !== null && Date.now() - hiddenAt > 30 * 60000)) {
    flushAnalytics()
    sessionId = createRequestId(); landing = true; lastPage = null
  }
  if (Number.isInteger(options.scene)) scene = options.scene!
  hiddenAt = null
}
export function analyticsHide() { foreground = false; hiddenAt = Date.now(); flushAnalytics() }
export function track(name: string, props: Props = {}) {
  try {
    if (!sessionId) analyticsShow()
    const currentToken = accessToken()
    const identity = getAnonymousId()
    if (token !== currentToken || envelope?.anonymousId !== identity || envelope?.sessionId !== sessionId) flushAnalytics()
    token = currentToken
    envelope = { anonymousId: identity, sessionId, source: 'miniprogram', app: 'search-app' }
    const pages = getCurrentPages()
    const event = { name, props: { ...props }, time: new Date().toISOString(), path: (pages[pages.length - 1]?.route || '').split('?')[0], locale: 'zh-CN' }
    if (bytes({ ...envelope, events: [event] }) > 32768) return
    if (bytes({ ...envelope, events: [...queue, event] }) > 32768) flushAnalytics()
    queue.push(event)
    if (queue.length >= 20 || !foreground) flushAnalytics()
    else if (!timer) timer = setTimeout(flushAnalytics, 3000)
  } catch (_) { /* Storage, clocks and telemetry must not block the UI. */ }
}
export function trackPage(page: object) {
  if (lastPage === page) return
  lastPage = page
  track('page_view', { landing, ...(landing ? { scene } : {}) })
  landing = false
}
export function resourcePath(url: string): string {
  const match = /^https?:\/\/[^/?#]+([^?#]*)/i.exec(url)
  return match ? (match[1] || '/') : ''
}
export function feedbackOutcome(requestId: string, type: string, result?: { id: string }, error?: unknown) {
  if (result) { track('feedback_submit', { requestId, type, status: 'success', feedbackId: result.id }); return }
  const failure = error as { code?: string; statusCode?: number; data?: { error?: string | { code?: string } } }
  const raw = typeof failure?.data?.error === 'string' ? failure.data.error : failure?.data?.error?.code || failure?.code
  const allowed = ['INVALID_FEEDBACK', 'INVALID_JSON', 'BODY_TOO_LARGE', 'INVALID_TOKEN', 'ENTRY_UNAVAILABLE', 'REQUEST_CONFLICT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR']
  const errorCode = raw && allowed.includes(raw) ? raw : failure?.statusCode === 401 ? 'INVALID_TOKEN' : failure?.statusCode === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE'
  track('feedback_submit', { requestId, type, status: 'error', errorCode })
}
