export interface AuthState<TUser = unknown> {
  userInfo?: TUser | null
  accessToken: string
  refreshToken: string
}
export interface AuthClient {
  login(): Promise<string>
  loginWithPhone(phoneNumber: string, verificationCode: string): Promise<string>
  sendSms(phoneNumber: string): Promise<{ success: boolean; message?: string }>
  logout(): void
  clearSession(): void
  restoreSession(): void
  ensureLogin(): Promise<string>
  refreshAccessToken(): Promise<string>
  getAccessToken(): string
  getSessionVersion(): number
}
export interface PlatformResponse { statusCode: number; data: unknown }
export interface AuthPlatform {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): void
  removeStorageSync(key: string): void
  login(options: { success(result: { code: string }): void; fail(error: unknown): void }): unknown
  request(options: { url: string; method: string; data: unknown; timeout: number; success(result: PlatformResponse): void; fail(error: unknown): void }): unknown
}
export interface AuthConfig<TUser = unknown> {
  baseUrl: string
  miniprogramApp: string
  getState(): AuthState<TUser>
  loginPath?: string
  refreshPath?: string
  sendSmsPath?: string
  storagePrefix?: string
  timeout?: number
  platform?: AuthPlatform
}
export class AuthError extends Error {
  constructor(code: string, message: string, statusCode?: number, data?: unknown)
  code: string
  error: string
  statusCode?: number
  data?: unknown
}
export function createAuthClient<TUser = unknown>(config: AuthConfig<TUser>): AuthClient
export function isAuthRequired(error: unknown): error is AuthError
