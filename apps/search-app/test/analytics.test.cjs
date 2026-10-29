const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
function setup() {
  let now = Date.parse('2026-10-29T10:00:00Z'), id = 0
  const timers = new Map(), requests = [], events = [], storage = new Map(), modules = new Map()
  const state = { accessToken: '' }
  const page = { route: 'pages/index/index' }
  const wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    request: options => requests.push(options),
  }
  const globals = { wx, getApp: () => ({ globalData: state }), getCurrentPages: () => [page],
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } },
    setTimeout: fn => { timers.set(++id, fn); return id }, clearTimeout: id => timers.delete(id),
  }
  function load(filename) {
    const full = path.resolve('apps/search-app/miniprogram', filename)
    if (modules.has(full)) return modules.get(full)
    const exports = {}
    modules.set(full, exports)
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    vm.runInNewContext(code, { ...globals, exports, require: spec => load(path.relative('apps/search-app/miniprogram', path.resolve(path.dirname(full), spec + '.ts'))) }, { filename: full })
    return exports
  }
  const analytics = load('utils/analytics.ts')
  return { ...analytics, load, requests, timers, storage, state, page, events, wx, advance: ms => { now += ms }, fire() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()) } }
}
function batch(request) { return request.data }
test('page dedup, landing, timer flush and fixed event timestamps', () => {
  const a = setup(), page = {}
  a.analyticsShow({ scene: 1007 }); a.trackPage(page); a.trackPage(page)
  a.advance(2000); a.fire()
  assert.equal(a.requests.length, 1)
  const data = batch(a.requests[0])
  assert.equal(data.source, 'miniprogram'); assert.equal(data.app, 'search-app')
  assert.equal(data.events.length, 1); assert.equal(data.events[0].props.landing, true)
  assert.equal(data.events[0].props.scene, 1007)
  assert.equal(data.events[0].time, '2026-10-29T10:00:00.000Z')
  assert.equal(a.requests[0].url, 'https://search.aidimsum.com/api/public/analytics/events')
  a.trackPage({}); a.trackPage(page); a.flushAnalytics()
  assert.equal(batch(a.requests[1]).events.length, 2)
})
test('background flush and 30-minute session boundary preserve anonymous identity', () => {
  const a = setup(); a.analyticsShow(); a.track('page_view'); a.analyticsHide()
  const first = batch(a.requests[0])
  a.advance(30 * 60000); a.analyticsShow(); a.track('page_view'); a.analyticsHide()
  assert.equal(batch(a.requests[1]).sessionId, first.sessionId)
  a.advance(30 * 60000 + 1); a.analyticsShow(); a.trackPage({}); a.flushAnalytics()
  const next = batch(a.requests[2])
  assert.notEqual(next.sessionId, first.sessionId)
  assert.equal(next.anonymousId, first.anonymousId); assert.equal(next.events[0].props.landing, true)
})
test('queued events retain their token across login/logout and failures never retry', () => {
  const a = setup(); a.track('page_view'); a.state.accessToken = 'account-a'; a.track('search_submit', { query: '茶' })
  assert.equal(a.requests[0].header.Authorization, undefined)
  a.state.accessToken = 'account-b'; a.flushAnalytics()
  assert.equal(a.requests[1].header.Authorization, 'Bearer account-a')
  a.requests[1].fail(); a.fire(); assert.equal(a.requests.length, 2)
  a.wx.request = () => { throw Error('platform unavailable') }
  assert.doesNotThrow(() => { a.track('page_view'); a.flushAnalytics() })
})
test('20-event and UTF-8 32KB limits split batches without oversized sends', () => {
  const a = setup()
  for (let i = 0; i < 21; i++) a.track('page_view')
  a.flushAnalytics(); assert.equal(batch(a.requests[0]).events.length, 20)
  for (let i = 0; i < 15; i++) a.track('search_submit', { query: '粤'.repeat(1000) })
  a.flushAnalytics()
  for (const request of a.requests) assert.ok(Buffer.byteLength(JSON.stringify(request.data)) <= 32768)
  const before = a.requests.length
  a.track('search_submit', { query: '粤'.repeat(12000) }); a.flushAnalytics()
  assert.equal(a.requests.length, before)
})
test('storage failures preserve a shared in-memory anonymous UUID; signed URLs stripped', () => {
  const a = setup(); a.wx.getStorageSync = () => { throw Error('storage denied') }
  const identity = a.load('utils/identity.ts')
  const id = identity.getAnonymousId(); a.track('page_view'); a.flushAnalytics()
  assert.equal(batch(a.requests[0]).anonymousId, id)
  assert.match(id, /^[0-9a-f-]{36}$/)
  assert.equal(a.resourcePath('https://cdn.example/audio/a.mp3?token=secret#x'), '/audio/a.mp3')
  assert.equal(a.resourcePath('invalid'), '')
})
test('audio actual play once, pre-play error dedup, cancellation and timeout', () => {
  const a = setup(), { observeAudio } = a.load('utils/media-analytics.ts')
  function player() { const callbacks = {}; return { callbacks, onPlay: fn => callbacks.play = fn, onError: fn => callbacks.error = fn, onStop: fn => callbacks.stop = fn, onEnded: fn => callbacks.end = fn } }
  const context = { entryId: 'e', surface: 'entry_detail', target: 'expression', senseIndex: 0 }
  const p = player(); observeAudio(p, 'https://cdn.test/a.mp3?secret=x', context)
  a.flushAnalytics(); assert.equal(a.requests.length, 0)
  p.callbacks.play(); p.callbacks.play(); a.flushAnalytics()
  assert.equal(batch(a.requests[0]).events.length, 1)
  assert.equal(batch(a.requests[0]).events[0].props.audioId, '/a.mp3')
  const q = player(); observeAudio(q, 'https://cdn.test/b.mp3', context); q.callbacks.error({ errCode: 10002 }); q.callbacks.error({ errCode: 10002 }); a.flushAnalytics()
  assert.equal(batch(a.requests[1]).events.length, 1)
  assert.equal(batch(a.requests[1]).events[0].props.errorType, 'network')
  const cancel = observeAudio(player(), 'https://cdn.test/c.mp3', context); cancel.cancel(); a.fire()
  assert.equal(a.requests.length, 2)
  observeAudio(player(), 'https://cdn.test/d.mp3', context); a.fire(); a.flushAnalytics()
  assert.equal(batch(a.requests[2]).events[0].props.errorType, 'timeout')
})
test('video requires advancing playback; timeout/error dedup and leave cancellation', () => {
  const a = setup(), { VideoAnalytics } = a.load('utils/media-analytics.ts'), videos = new VideoAnalytics()
  const context = { entryId: 'e', query: '茶', section: 'primary' }, url = 'https://cdn.test/v.mp4?secret=x'
  videos.start('v', url, context, 'none'); videos.progress('v', url, context, 0); a.flushAnalytics()
  assert.equal(a.requests.length, 0)
  videos.progress('v', url, context, 1); videos.progress('v', url, context, 2); a.flushAnalytics()
  assert.equal(batch(a.requests[0]).events.length, 1)
  videos.start('bad', url, context, 'none'); a.fire(); videos.error('bad', url, context, 'none'); a.flushAnalytics()
  assert.equal(batch(a.requests[1]).events.length, 1)
  assert.equal(batch(a.requests[1]).events[0].props.errorType, 'timeout')
  videos.start('closed', url, context, 'none'); videos.clear(); a.fire()
  assert.equal(a.requests.length, 2)
})

test('audio retries get new attempt IDs and feedback codes exclude arbitrary error text', () => {
  const a = setup(), { observeAudio } = a.load('utils/media-analytics.ts')
  const callbacks = {}
  const p = { onPlay: fn => callbacks.play = fn, onError: fn => callbacks.error = fn, onStop() {}, onEnded() {} }
  const handle = observeAudio(p, 'https://cdn.test/a.mp3', { entryId: 'e', surface: 'search_result', target: 'expression', senseIndex: 0 })
  callbacks.error({ errCode: 10004 }); a.flushAnalytics()
  handle.resume(); callbacks.error({ errCode: 10004 }); a.flushAnalytics()
  assert.notEqual(batch(a.requests[0]).events[0].props.loadAttemptId, batch(a.requests[1]).events[0].props.loadAttemptId)
  assert.equal(batch(a.requests[0]).events[0].props.playSessionId, batch(a.requests[1]).events[0].props.playSessionId)
  a.feedbackOutcome('request-id', 'other', undefined, { code: 'secret-text', statusCode: 503 })
  a.flushAnalytics()
  assert.equal(batch(a.requests[2]).events[0].props.errorCode, 'SERVICE_UNAVAILABLE')
  assert.ok(!JSON.stringify(batch(a.requests[2])).includes('secret-text'))
})
