# @dim-sum/http

小程序请求封装：请求携带 Token、401 刷新与最多一次授权重试，并支持游客访问。通过注入 auth 客户端复用鉴权，不强制页面跳转。

```ts
import { createHttpClient } from '@dim-sum/http'

const { request } = createHttpClient({
  baseUrl: 'https://search.aidimsum.com/api',
  auth, // createAuthClient() 创建的实例
  onAuthRequired: () => promptLogin(), // app 自己决定如何提示
})

// 纯游客：不带 Token、不刷新、不弹登录；公开搜索使用此模式。
await request('/search/entries?q=落&dataset=all', { auth: false })
// 可选登录：有 Token 则携带，没有则以游客访问；凭证失效可退回游客重试一次。
await request('/public-feed', { auth: 'optional' })
// 必须登录（默认）：无凭证时拒绝并通知 app，不会静默调用微信登录。
await request('/protected', { auth: true })
// 页面自行处理鉴权错误，关闭默认提示：
await request('/protected', { auth: true, promptLogin: false })
```

路径示例除公开搜索外用于说明参数，接入时请使用各业务真实接口。

可用参数：`method`、`data`、`header`、`timeout`、`auth`、`promptLogin`。请求返回响应 body；非 2xx 返回携带 `code`、`statusCode`、`data` 的错误。403 不刷新凭证；网络错误不会清除会话。外部域名请求被拒绝，避免意外发送凭证。

`auth: false` 忽略调用者手动传入的 Authorization；默认模式也统一由 auth 客户端提供 Token。并发 401 合并刷新，晚到的旧 Token 响应复用新 Token；重试仍 401 时停止，避免无限循环。可选登录刷新时遇到网络故障会直接报网络错误，不会误判为退出登录。

安装共享包后运行仓库 `npm run link:workspaces`（默认由 postinstall 执行），再在微信开发者工具构建 npm。

测试：`node --test packages/http/test/http.test.cjs`。
