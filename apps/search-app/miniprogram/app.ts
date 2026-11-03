import { analyticsShow, analyticsHide } from './utils/analytics'
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
  onShow(options) {
    if (!this.globalData.accessToken && !this.globalData.refreshToken) {
      this.restoreGlobalData()
    }
    // 从其他小程序返回时重新应用发音播放选项。
    wx.setInnerAudioOption({
      obeyMuteSwitch: false,
      speakerOn: true,
      fail: error => console.warn('音频播放选项设置失败', error),
    })
    analyticsShow(options)
  },
  onHide() { analyticsHide() },
  restoreGlobalData() { auth.restoreSession() },
  doLogin() { return auth.login() },
  doPhoneLogin(phone: string, code: string) { return auth.loginWithPhone(phone, code) },
  doSendSms(phone: string) { return auth.sendSms(phone) },
  ensureLogin() { return auth.ensureLogin() },
  logout() { auth.logout() },
})
