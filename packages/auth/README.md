# @dim-sum/auth

每个小程序创建自己的客户端，复用微信登录、恢复状态、刷新 Token 和退出登录逻辑。不会自动发起登录或跳转页面，也不会共用其他小程序的运行时状态。

```ts
import { createAuthClient } from '@dim-sum/auth'

const auth = createAuthClient({
  baseUrl: 'https://search.aidimsum.com/api/miniprogram',
  miniprogramApp: 'search-app',
  getState: () => getApp<IAppOption>().globalData,
})

auth.restoreSession()          // app.onLaunch：只恢复本地状态
await auth.login()             // 用户主动点击登录：wx.login → /auth/login
await auth.loginWithPhone('手机号', '验证码') // 手机号登录复用相同的会话保存逻辑
await auth.sendSms('手机号')                 // 只在用户点击发送时调用
await auth.ensureLogin()       // 有 Token 则返回；仅有 refreshToken 时刷新；游客返回 AUTH_REQUIRED
await auth.refreshAccessToken()
auth.logout()                 // 清除本机用户资料及两种 Token，保留外观与查询记录
```

配置参数：`baseUrl`、`miniprogramApp`、`getState`；可选 `loginPath`、`refreshPath`、`storagePrefix`、`timeout`。`platform` 用于注入微信 API 的测试替身。

- 接口返回的用户资料存入 `userInfo`，不会误用为仅含昵称/头像的 `WechatMiniprogram.UserInfo`。
- 登录和刷新各自合并并发请求；成功时同步 storage 与 globalData。
- 刷新凭证被服务端判定失效时清除完整会话；网络故障与服务端 5xx 保留本地凭证。
- 退出登录会作废正在进行的登录/刷新结果，避免迟到的响应恢复旧会话。
- `logout()` 是本机退出；当前后端没有注销 JWT 的接口。页面跳转、业务缓存清理等由各 app 决定。

当前搜索小程序对应的后端 `dim-sum-app/main` 需要部署新增 `search-app` 登录配置，并配置 `WECHAT_MINIPROGRAM_SEARCH_APPID`、`WECHAT_MINIPROGRAM_SEARCH_SECRET`。Secret 只配置在服务端。后端现有微信登录要求取得 UnionID。

测试：`node --test packages/auth/test/auth.test.cjs`。
