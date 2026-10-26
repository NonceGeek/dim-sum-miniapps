import { createAuthClient, isAuthRequired } from '@dim-sum/auth'
import { showCommonDialog } from '@dim-sum/common-dialog'
import { API } from '../config/api'

export const auth = createAuthClient({
  baseUrl: API.authBaseUrl,
  miniprogramApp: API.miniprogramApp,
  getState: () => getApp<IAppOption>().globalData,
})
let prompting = false

// UI 策略属于当前 app；公共鉴权/请求包不强制页面跳转。
export function promptLogin(host?: WechatMiniprogram.Page.Instance<any, any>) {
  const pages = getCurrentPages()
  const page = host || pages[pages.length - 1]
  if (prompting || page?.route === 'pages/login/login') return
  if (!page?.selectComponent('#common-dialog')) {
    wx.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  prompting = true
  showCommonDialog(page, {
    title: '登录后继续', content: '登录后可以使用该功能。', confirmText: '去登录', showCancel: true,
    onConfirm: () => wx.navigateTo({ url: '/pages/login/login?returnToPrevious=1', fail: () => wx.showToast({ title: '登录页面打开失败', icon: 'none' }) }),
    onComplete: () => { prompting = false },
  })
}

export async function requireLogin(host: WechatMiniprogram.Page.Instance<any, any>): Promise<boolean> {
  try { await auth.ensureLogin(); return true }
  catch (error) {
    if (isAuthRequired(error)) promptLogin(host)
    else wx.showToast({ title: error instanceof Error ? error.message : '登录状态检查失败', icon: 'none' })
    return false
  }
}

