import { applyAppearance } from './utils/appearance'
App<IAppOption>({
  globalData: {
    userInfo: undefined,
    accessToken: '',
    refreshToken: '',
    themeMode: 'auto',
    theme: 'light',
  },
  onLaunch() {
    wx.onThemeChange(() => { const pages = getCurrentPages(); const page = pages[pages.length - 1]; if (page) applyAppearance(page) })
  },
})
