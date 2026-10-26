function requestError(code, message, statusCode, data) {
  const error = new Error(message);
  Object.assign(error, { code, error: message, statusCode, data });
  return error;
}
function createHttpClient(config) {
  const platform = config.platform || wx;
  const base = config.baseUrl.replace(/\/$/, '');
  const origin = base.match(/^https?:\/\/[^/]+/i);
  function resolveUrl(url) {
    if (/^https?:\/\//i.test(url)) {
      if (!origin || url.match(/^https?:\/\/[^/]+/i)?.[0].toLowerCase() !== origin[0].toLowerCase()) {
        throw requestError('INVALID_URL', '请求地址不属于当前服务');
      }
      return url;
    }
    if (url.startsWith('//')) throw requestError('INVALID_URL', '请求地址无效');
    return base + '/' + url.replace(/^\//, '');
  }
  function send(url, options, token) {
    const header = {};
    for (const key of Object.keys(options.header || {})) {
      if (key.toLowerCase() !== 'authorization') header[key] = options.header[key];
    }
    if (token) header.Authorization = `Bearer ${token}`;
    return new Promise((resolve, reject) => platform.request({
      url, method: options.method || 'GET', data: options.data,
      timeout: options.timeout || config.timeout || 15000, header,
      success: resolve,
      fail: () => reject(requestError('NETWORK_ERROR', '网络连接失败，请稍后重试')),
    }));
  }
  function readResponse(response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return response.data;
    const body = response.data;
    const message = body && typeof body.error === 'string' ? body.error : '请求失败，请稍后重试';
    throw requestError(response.statusCode === 401 ? 'AUTH_REQUIRED' : 'HTTP_ERROR', message, response.statusCode, body);
  }
  async function request(path, options = {}) {
    const url = resolveUrl(path);
    const mode = options.auth === undefined ? true : options.auth;
    if (![true, false, 'optional'].includes(mode)) throw requestError('INVALID_OPTIONS', '无效的 auth 参数');
    const required = mode === true;
    const notify = error => {
      if (required && options.promptLogin !== false && config.onAuthRequired) config.onAuthRequired(error);
      throw error;
    };
    if (mode === false) return readResponse(await send(url, options, ''));
    let token = config.auth.getAccessToken();
    if (required && !token) {
      try { token = await config.auth.ensureLogin(); }
      catch (error) { if (error.code === 'AUTH_REQUIRED') return notify(error); throw error; }
    }
    const version = config.auth.getSessionVersion();
    let response = await send(url, options, token);
    if (token && version !== config.auth.getSessionVersion()) throw requestError('AUTH_CANCELLED', '登录状态已变化，请重试');
    if (response.statusCode !== 401) return readResponse(response);
    if (!token) return readResponse(response);
    if (version !== config.auth.getSessionVersion()) throw requestError('AUTH_CANCELLED', '登录状态已变化，请重试');
    try {
      // 晚到的旧 Token 的 401 可以直接使用已经刷新的 Token，避免再次刷新。
      const current = config.auth.getAccessToken();
      const refreshed = current && current !== token ? current : await config.auth.refreshAccessToken();
      if (version !== config.auth.getSessionVersion()) throw requestError('AUTH_CANCELLED', '登录状态已变化，请重试');
      response = await send(url, options, refreshed);
      if (version !== config.auth.getSessionVersion()) throw requestError('AUTH_CANCELLED', '登录状态已变化，请重试');
      if (response.statusCode !== 401) return readResponse(response);
      if (config.auth.getAccessToken() === refreshed) config.auth.clearSession();
      throw requestError('AUTH_REQUIRED', '登录已过期，请重新登录', 401);
    } catch (error) {
      if (error.code !== 'AUTH_REQUIRED') throw error;
      if (mode === 'optional') return readResponse(await send(url, options, ''));
      return notify(error);
    }
  }
  return { request };
}
module.exports = { createHttpClient };
