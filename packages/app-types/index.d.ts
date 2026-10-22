/** 用户选择的外观模式；auto 表示跟随系统。 */
export type ThemeMode = 'auto' | 'light' | 'dark'

/** 当前实际应用的主题。 */
export type ThemeValue = 'light' | 'dark'

/**
 * 每个小程序独立持有这些字段；这里只共享类型，不创建运行时状态。
 * 用户结构由消费 app 传入，既支持微信资料，也支持后端用户资料。
 */
export interface BaseGlobalData<TUser = unknown> {
  userInfo?: TUser | null
  accessToken: string
  refreshToken: string
  themeMode: ThemeMode
  theme: ThemeValue
}
