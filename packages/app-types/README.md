# @dim-sum/app-types

共享 `BaseGlobalData<TUser>`、`ThemeMode` 与 `ThemeValue`，只提供类型，不包含运行时代码或共享状态实例。

在 app 的 `devDependencies` 中添加 `"@dim-sum/app-types": "1.0.0"`，根目录运行 `npm install`。

```ts
import type { BaseGlobalData } from '@dim-sum/app-types'

interface AppUser {
  id: string
  name: string
}

interface CollectionGlobalData extends BaseGlobalData<AppUser> {
  questionnaireStatus: { completed?: boolean }
}
```

在 app 的 `typings/index.d.ts` 中通过 `declare global` 定义本 app 的 `IAppOption`，将 `globalData` 设为公共类型或扩展后的类型。每个 `app.ts` 仍独立初始化自己的 `globalData`。

`themeMode` 统一使用 `auto | light | dark`；`theme` 使用 `light | dark`。旧设置若用 `system` 表示跟随系统，在 app 读取设置时转换为 `auto`。用户类型由 app 指定，公共包不依赖微信 API 类型，也不强制不同业务采用同一用户结构。

登录、令牌刷新、外观持久化仍由各 app 实现，公共类型不代表这些服务已接入。微信 API 的 `typings/types/` 本轮保持原状。
