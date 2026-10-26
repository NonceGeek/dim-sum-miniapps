const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, deferred, tick } = require('./helpers.cjs');
const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
const user = { id: 'user-1', name: '用户' };

test('restore and logout synchronize state/storage and keep appearance/history', () => {
  const f = fixture(() => {}, {}, { accessToken: 'saved', refreshToken: 'saved-refresh', userInfo: user, 'cantonese-appearance': 'dark', history: ['落'] });
  f.auth.restoreSession();
  assert.equal(f.state.accessToken, 'saved');
  assert.deepEqual(f.state.userInfo, user);
  f.auth.logout();
  assert.equal(f.state.accessToken, '');
  assert.equal(f.state.refreshToken, '');
  assert.equal(f.state.userInfo, null);
  assert.equal(f.state.theme, 'dark');
  assert.equal(f.storage.has('accessToken'), false);
  assert.equal(f.storage.get('cantonese-appearance'), 'dark');
  assert.deepEqual(f.storage.get('history'), ['落']);
});
test('orphan user information does not restore a logged-in state', () => {
  const f = fixture(() => {}, {}, { userInfo: user });
  f.auth.restoreSession();
  assert.equal(f.state.userInfo, null);
});
test('login requests are deduplicated and use the configured app selector', async () => {
  const f = fixture(options => {
    assert.equal(options.url, 'https://example.test/api/miniprogram/auth/login');
    assert.deepEqual(options.data, { code: 'wx-code', miniprogramApp: 'test-app' });
    return { statusCode: 200, data: { ...tokens, user } };
  });
  const first = f.auth.login();
  assert.equal(first, f.auth.login());
  assert.equal(await first, tokens.accessToken);
  assert.equal(f.loginCalls, 1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.storage.get('refreshToken'), tokens.refreshToken);
  assert.deepEqual(f.state.userInfo, user);
});
test('an incomplete login response does not create a session', async () => {
  const f = fixture(() => ({ statusCode: 200, data: { accessToken: 'invalid', user } }));
  await assert.rejects(f.auth.login(), { code: 'INVALID_RESPONSE' });
  assert.equal(f.state.accessToken, '');
  assert.equal(f.storage.size, 0);
});
test('refresh is deduplicated, rotates both tokens, and preserves user info', async () => {
  const f = fixture(() => ({ statusCode: 200, data: tokens }), { accessToken: 'old', refreshToken: 'refresh', userInfo: user });
  const first = f.auth.refreshAccessToken();
  assert.equal(first, f.auth.refreshAccessToken());
  assert.equal(await first, tokens.accessToken);
  assert.equal(f.requests.length, 1);
  assert.equal(f.state.refreshToken, tokens.refreshToken);
  assert.deepEqual(f.state.userInfo, user);
});
test('network and server failures do not erase a valid local session', async () => {
  for (const network of [true, false]) {
    const f = fixture(() => network ? Promise.reject(new Error('offline')) : { statusCode: 500, data: { error: 'service unavailable' } }, { accessToken: 'old', refreshToken: 'refresh', userInfo: user });
    await assert.rejects(f.auth.refreshAccessToken(), { code: network ? 'NETWORK_ERROR' : 'HTTP_ERROR' });
    assert.equal(f.state.accessToken, 'old');
    assert.deepEqual(f.state.userInfo, user);
  }
});
test('invalid refresh token clears user and both tokens', async () => {
  const f = fixture(() => ({ statusCode: 401, data: {} }), { accessToken: 'old', refreshToken: 'invalid', userInfo: user });
  await assert.rejects(f.auth.refreshAccessToken(), { code: 'AUTH_REQUIRED' });
  assert.equal(f.state.userInfo, null);
  assert.equal(f.state.accessToken, '');
  assert.equal(f.state.refreshToken, '');
});
test('logout during login prevents an old response from logging the user back in', async () => {
  const response = deferred();
  const f = fixture(() => response.promise);
  const login = f.auth.login();
  const rejection = assert.rejects(login, { code: 'AUTH_CANCELLED' });
  await tick();
  f.auth.logout();
  response.resolve({ statusCode: 200, data: { ...tokens, user } });
  await rejection;
  assert.equal(f.state.accessToken, '');
  assert.equal(f.storage.has('userInfo'), false);
});
test('a stale refresh response cannot overwrite a new login', async () => {
  const response = deferred();
  const f = fixture(options => options.url.endsWith('/refresh') ? response.promise : { statusCode: 200, data: { ...tokens, user } }, { accessToken: 'old', refreshToken: 'old-refresh' });
  const refreshing = assert.rejects(f.auth.refreshAccessToken(), { code: 'AUTH_CANCELLED' });
  await tick();
  await f.auth.login();
  response.resolve({ statusCode: 200, data: { accessToken: 'stale', refreshToken: 'stale' } });
  await refreshing;
  assert.equal(f.state.accessToken, tokens.accessToken);
});
test('ensureLogin does not silently trigger WeChat login for a guest', async () => {
  const f = fixture(() => {});
  await assert.rejects(f.auth.ensureLogin(), { code: 'AUTH_REQUIRED' });
  assert.equal(f.loginCalls, 0);
  assert.equal(f.requests.length, 0);
});
test('phone login uses the same session storage and does not call wx.login', async () => {
  const f = fixture(options => {
    assert.deepEqual(options.data, { phoneNumber: '13800000000', verificationCode: '123456', miniprogramApp: 'test-app' });
    return { statusCode: 200, data: { ...tokens, user } };
  });
  await f.auth.loginWithPhone('13800000000', '123456');
  assert.equal(f.loginCalls, 0);
  assert.equal(f.state.accessToken, tokens.accessToken);
  assert.deepEqual(f.storage.get('userInfo'), user);
});
test('sending an SMS does not authenticate or modify a session', async () => {
  const f = fixture(options => {
    assert.equal(options.url, 'https://example.test/api/miniprogram/auth/send-sms');
    assert.deepEqual(options.data, { phoneNumber: '13800000000' });
    return { statusCode: 200, data: { success: true } };
  });
  assert.deepEqual(await f.auth.sendSms('13800000000'), { success: true });
  assert.equal(f.state.accessToken, '');
  assert.equal(f.storage.size, 0);
});
