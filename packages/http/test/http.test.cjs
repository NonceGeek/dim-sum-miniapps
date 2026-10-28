const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHttpClient } = require('../miniprogram/index.js');
const { fixture, deferred, tick } = require('../../auth/test/helpers.cjs');
const initial = { accessToken: 'old', refreshToken: 'refresh', userInfo: { id: 'user' } };
const rotated = { accessToken: 'new', refreshToken: 'new-refresh' };
function client(f, notify = () => {}) {
  return createHttpClient({ baseUrl: 'https://example.test/api', auth: f.auth, platform: f.platform, onAuthRequired: notify }).request;
}

test('auth:false strips authorization even for a logged-in user; never refreshes', async () => {
  const f = fixture(options => {
    assert.equal(options.header.Authorization, undefined);
    assert.equal(options.header.authorization, undefined);
    return { statusCode: 200, data: ['public'] };
  }, initial);
  const request = client(f);
  assert.deepEqual(await request('/search', { auth: false, header: { authorization: 'manual-secret' } }), ['public']);
  assert.equal(f.requests.length, 1);
});
test('a guest 401 does not clear an existing session or invoke login prompts', async () => {
  let prompts = 0;
  const f = fixture(() => ({ statusCode: 401, data: {} }), initial);
  await assert.rejects(client(f, () => prompts++)('/public', { auth: false }), { code: 'AUTH_REQUIRED' });
  assert.equal(prompts, 0);
  assert.equal(f.requests.length, 1);
  assert.equal(f.state.accessToken, 'old');
});
test('required requests without credentials reject before sending, with configurable prompt', async () => {
  let prompts = 0;
  const f = fixture(() => {});
  const request = client(f, () => prompts++);
  await assert.rejects(request('/protected'), { code: 'AUTH_REQUIRED' });
  await assert.rejects(request('/protected', { promptLogin: false }), { code: 'AUTH_REQUIRED' });
  assert.equal(prompts, 1);
  assert.equal(f.requests.length, 0);
  assert.equal(f.loginCalls, 0);
});
test('optional requests support guests without a login prompt', async () => {
  const f = fixture(options => ({ statusCode: 200, data: options.header.Authorization || 'guest' }));
  assert.equal(await client(f)('/feed', { auth: 'optional' }), 'guest');
});
test('concurrent 401 responses share one refresh and all retry with rotated credentials', async () => {
  let refreshes = 0;
  const f = fixture(options => {
    if (options.url.endsWith('/auth/refresh')) { refreshes++; return { statusCode: 200, data: rotated }; }
    return options.header.Authorization === 'Bearer new' ? { statusCode: 200, data: options.data } : { statusCode: 401, data: {} };
  }, initial);
  const request = client(f);
  const results = await Promise.all([1, 2, 3, 4].map(id => request('/protected', { method: 'POST', data: { id }, header: { 'X-Trace': 'kept' } })));
  assert.deepEqual(results, [1, 2, 3, 4].map(id => ({ id })));
  assert.equal(refreshes, 1);
  for (const item of f.requests.filter(x => x.header?.Authorization === 'Bearer new')) {
    assert.equal(item.method, 'POST');
    assert.equal(item.header['X-Trace'], 'kept');
  }
});
test('a late 401 for the old token reuses the new token without a second refresh', async () => {
  const late = deferred();
  let refreshes = 0;
  const f = fixture(options => {
    if (options.url.endsWith('/auth/refresh')) { refreshes++; return { statusCode: 200, data: rotated }; }
    if (options.url.endsWith('/late') && options.header.Authorization === 'Bearer old') return late.promise;
    return { statusCode: options.header.Authorization === 'Bearer new' ? 200 : 401, data: 'ok' };
  }, initial);
  const request = client(f);
  const waiting = request('/late');
  await request('/early');
  late.resolve({ statusCode: 401, data: {} });
  assert.equal(await waiting, 'ok');
  assert.equal(refreshes, 1);
});
test('refresh failure settles every waiting request and clears credentials', { timeout: 1000 }, async () => {
  const failure = deferred();
  let refreshes = 0;
  const f = fixture(options => {
    if (options.url.endsWith('/auth/refresh')) { refreshes++; return failure.promise; }
    return { statusCode: 401, data: {} };
  }, initial);
  const request = client(f);
  const settled = Promise.allSettled([request('/a'), request('/b'), request('/c')]);
  await tick();
  failure.resolve({ statusCode: 401, data: {} });
  const results = await settled;
  assert(results.every(item => item.status === 'rejected' && item.reason.code === 'AUTH_REQUIRED'));
  assert.equal(refreshes, 1);
  assert.equal(f.state.accessToken, '');
});
test('optional mode retries as guest when refresh credentials expire', async () => {
  let prompts = 0;
  const f = fixture(options => {
    if (options.url.endsWith('/auth/refresh')) return { statusCode: 401, data: {} };
    return options.header.Authorization ? { statusCode: 401, data: {} } : { statusCode: 200, data: 'guest-feed' };
  }, initial);
  assert.equal(await client(f, () => prompts++)('/feed', { auth: 'optional' }), 'guest-feed');
  assert.equal(prompts, 0);
  assert.equal(f.state.userInfo, null);
});
test('403/500 errors do not trigger refresh or log the user out', async () => {
  for (const statusCode of [403, 500]) {
    const f = fixture(() => ({ statusCode, data: {} }), initial);
    await assert.rejects(client(f)('/protected'), { statusCode, code: 'HTTP_ERROR' });
    assert.equal(f.requests.length, 1);
    assert.equal(f.state.accessToken, 'old');
  }
});
test('a second 401 after refresh stops retrying and prompts login', async () => {
  let prompts = 0;
  const f = fixture(options => options.url.endsWith('/auth/refresh') ? { statusCode: 200, data: rotated } : { statusCode: 401, data: {} }, initial);
  await assert.rejects(client(f, () => prompts++)('/protected'), { code: 'AUTH_REQUIRED' });
  assert.equal(f.requests.length, 3);
  assert.equal(prompts, 1);
  assert.equal(f.state.accessToken, '');
});
test('a response arriving after logout cannot continue a protected request', async () => {
  const response = deferred();
  const f = fixture(() => response.promise, initial);
  const rejection = assert.rejects(client(f)('/private'), { code: 'AUTH_CANCELLED' });
  await tick();
  f.auth.logout();
  response.resolve({ statusCode: 200, data: 'private data' });
  await rejection;
});
test('cross-origin URLs are rejected before any credentials can be sent', async () => {
  const f = fixture(() => {}, initial);
  await assert.rejects(client(f)('https://other.test/private'), { code: 'INVALID_URL' });
  assert.equal(f.requests.length, 0);
});

test('structured business errors preserve code, message and response date', async () => {
  const f = fixture(() => ({ statusCode: 404, header: { Date: 'Wed, 28 Oct 2026 04:00:00 GMT' }, data: { error: { code: 'DAILY_ENTRY_UNAVAILABLE', message: '今日内容已下架' } } }));
  await assert.rejects(client(f)('/daily', { auth: false }), error => error.code === 'DAILY_ENTRY_UNAVAILABLE' && error.message === '今日内容已下架' && !!error.responseHeaders.Date);
});
