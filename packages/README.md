# 共享包

- `auth/`：登录、退出、恢复状态与 Token 刷新。
- `http/`：游客/可选登录/必须登录请求与 401 重试。
- `app-types/`：公共 `BaseGlobalData<TUser>` 和主题类型，各 app 独立扩展与初始化。
- `common-dialog/`：共享弹窗组件、调用函数与类型定义，各 app 自行提供主题样式。

新增包放在独立子目录并提供 `package.json`，由根目录的 `packages/*` workspace 管理。app 在自己的 dependencies 中声明使用的共享包。

安装依赖后的 workspace 本地链接由根目录 `postinstall` 自动生成；使用 `--ignore-scripts` 安装时，手动运行 `npm run link:workspaces`，再在微信开发者工具中构建 npm。
