/// <reference path="./types/index.d.ts" />
import type { BaseGlobalData } from '@dim-sum/app-types'

declare global {
  interface SearchUser {
    id: string
    name?: string | null
    avatar?: string | null
    role?: string
    isSystemAdmin?: boolean
  }
  interface IAppOption {
    globalData: BaseGlobalData<SearchUser>
    doLogin(): Promise<string>
    doPhoneLogin(phone: string, code: string): Promise<string>
    doSendSms(phone: string): Promise<{ success: boolean; message?: string }>
    ensureLogin(): Promise<string>
    restoreGlobalData(): void
    logout(): void
  }
}
