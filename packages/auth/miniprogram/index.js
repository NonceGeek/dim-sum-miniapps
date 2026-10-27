class AuthError extends Error {
  constructor(code, message, statusCode, data) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.error = message;
    this.statusCode = statusCode;
    this.data = data;
  }
}
function isAuthRequired(error) { return Boolean(error && error.code === 'AUTH_REQUIRED'); }
function createAuthClient(config) {
  const platform = config.platform || wx;
  const base = config.baseUrl.replace(/\/$/, '');
  const prefix = config.storagePrefix || '';
  let generation = 0;
  let loginPromise = null;
  let refreshPromise = null;
  function state() { return config.getState(); }
  function key(name) { return prefix + name; }
  function clearSession() {
    generation += 1;
    loginPromise = null;
    refreshPromise = null;
    Object.assign(state(), { userInfo: null, accessToken: '', refreshToken: '' });
    for (const name of ['accessToken', 'refreshToken', 'userInfo']) platform.removeStorageSync(key(name));
  }
  function saveTokens(data) {
    platform.setStorageSync(key('accessToken'), data.accessToken);
    platform.setStorageSync(key('refreshToken'), data.refreshToken);
    Object.assign(state(), { accessToken: data.accessToken, refreshToken: data.refreshToken });
  }
  function assertCurrent(version) {
    if (generation !== version) throw new AuthError('AUTH_CANCELLED', '登录状态已变化，请重试');
  }
  function post(path, data) {
    return new Promise((resolve, reject) => platform.request({
      url: base + path, method: 'POST', data, timeout: config.timeout || 15000,
      success(response) {
        const body = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300) return resolve(body);
        const configMissing = body.error === 'Invalid miniprogramApp' || body.error === 'Server configuration error';
        reject(new AuthError(configMissing ? 'AUTH_CONFIG_ERROR' : 'HTTP_ERROR', configMissing ? '当前小程序的登录服务尚未配置' : typeof body.error === 'string' ? body.error : '登录服务请求失败', response.statusCode, body));
      },
      fail: () => reject(new AuthError('NETWORK_ERROR', '网络连接失败，请稍后重试')),
    }));
  }
  function validateTokens(data) {
    if (!data || typeof data.accessToken !== 'string' || !data.accessToken || typeof data.refreshToken !== 'string' || !data.refreshToken) {
      throw new AuthError('INVALID_RESPONSE', '登录服务返回的数据不完整');
    }
  }
  function restoreSession() {
    generation += 1;
    loginPromise = null;
    refreshPromise = null;
    // 启动时只恢复本地状态，不强制游客登录，也不主动发请求。
    const accessToken = platform.getStorageSync(key('accessToken'));
    const refreshToken = platform.getStorageSync(key('refreshToken'));
    const user = platform.getStorageSync(key('userInfo'));
    const hasSession = typeof accessToken === 'string' && accessToken || typeof refreshToken === 'string' && refreshToken;
    Object.assign(state(), {
      accessToken: typeof accessToken === 'string' ? accessToken : '',
      refreshToken: typeof refreshToken === 'string' ? refreshToken : '',
      userInfo: hasSession && user && typeof user === 'object' ? user : null,
    });
  }
  function authenticate(buildPayload) {
    if (loginPromise) return loginPromise;
    const version = ++generation;
    refreshPromise = null;
    const pending = (async () => {
      const payload = await buildPayload();
      assertCurrent(version);
      const data = await post(config.loginPath || '/auth/login', { ...payload, miniprogramApp: config.miniprogramApp });
      assertCurrent(version);
      validateTokens(data);
      if (!data.user || typeof data.user !== 'object') throw new AuthError('INVALID_RESPONSE', '登录服务未返回用户资料');
      saveTokens(data);
      platform.setStorageSync(key('userInfo'), data.user);
      state().userInfo = data.user;
      return data.accessToken;
    })();
    loginPromise = pending;
    pending.then(() => { if (loginPromise === pending) loginPromise = null; }, () => { if (loginPromise === pending) loginPromise = null; });
    return pending;
  }
  function login() {
    return authenticate(async () => {
      const code = await new Promise((resolve, reject) => platform.login({
        success: result => result.code ? resolve(result.code) : reject(new AuthError('LOGIN_FAILED', '微信登录失败，请重试')),
        fail: () => reject(new AuthError('LOGIN_FAILED', '微信登录失败，请重试')),
      }));
      return { code };
    });
  }
  function loginWithPhone(phoneNumber, verificationCode) {
    return authenticate(async () => ({ phoneNumber, verificationCode }));
  }
  function sendSms(phoneNumber) {
    return post(config.sendSmsPath || '/auth/send-sms', { phoneNumber, miniprogramApp: config.miniprogramApp });
  }
  function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;
    const version = generation;
    const token = state().refreshToken;
    if (!token) {
      clearSession();
      return Promise.reject(new AuthError('AUTH_REQUIRED', '登录已过期，请重新登录'));
    }
    const pending = (async () => {
      let data;
      try { data = await post(config.refreshPath || '/auth/refresh', { refreshToken: token }); }
      catch (error) {
        assertCurrent(version);
        if (error.statusCode === 400 || error.statusCode === 401) {
          clearSession();
          throw new AuthError('AUTH_REQUIRED', '登录已过期，请重新登录');
        }
        // 网络故障、服务异常不等于凭证失效。
        throw error;
      }
      assertCurrent(version);
      validateTokens(data);
      saveTokens(data);
      return data.accessToken;
    })();
    refreshPromise = pending;
    pending.then(() => { if (refreshPromise === pending) refreshPromise = null; }, () => { if (refreshPromise === pending) refreshPromise = null; });
    return pending;
  }
  function ensureLogin() {
    if (state().accessToken) return Promise.resolve(state().accessToken);
    if (state().refreshToken) return refreshAccessToken();
    return Promise.reject(new AuthError('AUTH_REQUIRED', '登录后才能使用该功能'));
  }
  return {
    login, loginWithPhone, sendSms, logout: clearSession, clearSession, restoreSession, ensureLogin, refreshAccessToken,
    getAccessToken: () => state().accessToken || '',
    getSessionVersion: () => generation,
  };
}
module.exports = { createAuthClient, AuthError, isAuthRequired };
