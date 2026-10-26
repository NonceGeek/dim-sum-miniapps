const { createAuthClient } = require('../miniprogram/index.js');
function fixture(handler, initial = {}, stored = {}) {
  const state = { userInfo: null, accessToken: '', refreshToken: '', theme: 'dark', ...initial };
  const storage = new Map(Object.entries(stored));
  const requests = [];
  let loginCalls = 0;
  const platform = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    login: options => { loginCalls += 1; queueMicrotask(() => options.success({ code: 'wx-code' })); },
    request: options => {
      requests.push(options);
      Promise.resolve().then(() => handler(options)).then(result => options.success(result), error => options.fail(error));
    },
  };
  const auth = createAuthClient({ baseUrl: 'https://example.test/api/miniprogram', miniprogramApp: 'test-app', getState: () => state, platform });
  return { auth, platform, state, storage, requests, get loginCalls() { return loginCalls; } };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
module.exports = { fixture, deferred, tick };
