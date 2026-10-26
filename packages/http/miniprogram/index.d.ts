/** true：必须登录；false：纯游客；optional：有凭证则携带，否则按游客请求。 */
export type RequestAuth = boolean | 'optional'
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  data?: unknown
  header?: Record<string, string>
  timeout?: number
  auth?: RequestAuth
  promptLogin?: boolean
}
export interface HttpError extends Error { code: string; error: string; statusCode?: number; data?: unknown }
export interface HttpAuthClient {
  getAccessToken(): string
  getSessionVersion(): number
  ensureLogin(): Promise<string>
  refreshAccessToken(): Promise<string>
  clearSession(): void
}
export interface HttpConfig {
  baseUrl: string
  auth: HttpAuthClient
  timeout?: number
  onAuthRequired?(error: HttpError): void
  platform?: { request(options: {
    url: string; method: string; data: unknown; timeout: number; header: Record<string, string>
    success(result: { statusCode: number; data: unknown }): void
    fail(error: unknown): void
  }): unknown }
}
export interface HttpClient { request<T = unknown>(path: string, options?: RequestOptions): Promise<T> }
export function createHttpClient(config: HttpConfig): HttpClient
