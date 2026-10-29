const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('apps/search-app/miniprogram/utils/daily-entry.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
function fixture() {
  let time = Date.parse('2026-10-28T04:00:00Z'), tick = 0, calls = 0, failure
  const storage = new Map()
  const response = () => ({ date: new Date(time + 28800000).toISOString().slice(0, 10), timeZone: 'Asia/Shanghai', serverTime: new Date(time).toISOString(), expiresAt: new Date(Math.floor((time + 28800000) / 86400000) * 86400000 + 57600000).toISOString(), entry: { id: 'one', expression: '唔该', available: true, senses: [] } })
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => name === './http' ? { default: async () => { calls++; if (failure) throw failure; return response() } } : { API: { baseUrl: 'https://example.test/api' } }, Date: class extends Date { static now() { return time } }, wx: { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }), getPerformance: () => ({ now: () => tick }), getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) } })
  return { api: exports, storage, calls: () => calls, advance(ms) { time += ms; tick += ms }, fail(value) { failure = value } }
}
test('same-day persisted cache and concurrent requests reuse one fetch', async () => {
  const f = fixture()
  await Promise.all([f.api.loadDailyEntry(), f.api.loadDailyEntry()])
  await f.api.loadDailyEntry()
  assert.equal(f.calls(), 1)
  assert.equal(f.storage.size, 1)
})
test('refresh delay follows expiry and decreases as cached content ages', async () => {
  const f = fixture()
  const result = await f.api.loadDailyEntry()
  assert.equal(f.api.getDailyRefreshDelay(result.response.expiresAt), 12 * 3600000)
  f.advance(8 * 3600000)
  assert.equal(f.api.getDailyRefreshDelay(result.response.expiresAt), 4 * 3600000)
  assert.equal(f.api.getDailyRefreshDelay(), 4 * 3600000)
  f.advance(4 * 3600000)
  assert.equal(f.api.getDailyRefreshDelay(result.response.expiresAt), 1000)
})
test('expired content is labelled offline on failure and succeeds on retry', async () => {
  const f = fixture(); await f.api.loadDailyEntry(); f.advance(86400000); f.fail({ statusCode: 503 })
  const old = await f.api.loadDailyEntry(); assert.equal(old.offline, true); assert.equal(old.response.date, '2026-10-28')
  f.fail(null); const fresh = await f.api.loadDailyEntry(); assert.equal(fresh.offline, false); assert.equal(fresh.response.date, '2026-10-29')
})
test('404 clears content, blocks same-day refetch and retries next day', async () => {
  const f = fixture(); f.fail({ statusCode: 404, data: { error: { code: 'DAILY_ENTRY_UNAVAILABLE' } } })
  assert.equal((await f.api.loadDailyEntry()).unavailable, true)
  await f.api.loadDailyEntry(); assert.equal(f.calls(), 1)
  f.advance(86400000); f.fail(null); assert.ok((await f.api.loadDailyEntry()).response)
})
test('detail invalidation blocks entry, explicit clear permits refetch', async () => {
  const f = fixture(); await f.api.loadDailyEntry(); f.api.invalidateDailyEntry('one')
  assert.equal((await f.api.loadDailyEntry()).unavailable, true)
  f.api.invalidateDailyEntry(); assert.ok((await f.api.loadDailyEntry()).response); assert.equal(f.calls(), 2)
})
test('background validity checks do not retry a failed request', async () => {
  const f = fixture(); f.fail({ statusCode: 503 }); await f.api.loadDailyEntry()
  await f.api.loadDailyEntry(true); await f.api.loadDailyEntry(true); assert.equal(f.calls(), 1)
  f.fail(null); assert.ok((await f.api.loadDailyEntry()).response); assert.equal(f.calls(), 2)
})
