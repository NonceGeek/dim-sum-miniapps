import { applyAppearance } from './utils/appearance'
import { auth } from './utils/auth'
App<IAppOption>({
  globalData: {
    userInfo: undefined,
    accessToken: '',
    refreshToken: '',
    themeMode: 'auto',
    theme: 'light',
  },
  onLaunch() {
    this.restoreGlobalData()
    wx.onThemeChange(() => { const pages = getCurrentPages(); const page = pages[pages.length - 1]; if (page) applyAppearance(page) })
  },
  restoreGlobalData() { auth.restoreSession() },
  doLogin() { return auth.login() },
  doPhoneLogin(phone: string, code: string) { return auth.loginWithPhone(phone, code) },
  doSendSms(phone: string) { return auth.sendSms(phone) },
  ensureLogin() { return auth.ensureLogin() },
  logout() { auth.logout() },
})
