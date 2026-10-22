# @dim-sum/common-dialog

多个微信小程序共用的 TDesign 弹窗组件、`showCommonDialog` 调用函数和 TypeScript 类型。共享包不读取某个 app 的存储，不引用 `--ds-*` 业务主题变量。

## 接入

小程序自身依赖 `tdesign-miniprogram`，并在 `package.json` 中添加 `"@dim-sum/common-dialog": "1.0.0"`。在仓库根目录运行 `npm install`，再在微信开发者工具中「构建 npm」。

页面 JSON：

```json
{
  "usingComponents": {
    "common-dialog": "@dim-sum/common-dialog/dialog/index"
  }
}
```

页面 WXML：

```xml
<common-dialog id="common-dialog" theme="{{dialogThemeMode}}" theme-style="{{dialogThemeStyle}}" />
```

页面 TypeScript：

```ts
import { showCommonDialog, type CommonDialogOptions } from '@dim-sum/common-dialog'

showCommonDialog(this, {
  title: '答题完成',
  content: '本轮得分：100 分',
  confirmText: '完成',
  onConfirm: () => {},
})
```

## 每个 app 自定义样式

`theme` 可设为 `light` 或 `dark`，省略时跟随系统。`theme-style` 传入 CSS 自定义属性声明；`customStyle` 选项可对某一次弹窗补充或覆盖样式。主题配置由消费 app 保存，搜索小程序的示例见 `apps/search-app/miniprogram/config/common-dialog.ts`。

| 变量 | 用途 |
| --- | --- |
| `--common-dialog-surface` / `--common-dialog-border` | 弹窗底色与边框 |
| `--common-dialog-title-color` / `--common-dialog-content-color` | 标题、正文颜色 |
| `--common-dialog-radius` | 弹窗圆角 |
| `--common-dialog-confirm-bg` / `--common-dialog-confirm-color` | 确认按钮背景、文字；背景支持渐变 |
| `--common-dialog-cancel-bg` | 取消按钮底色 |
| `--common-dialog-button-radius` / `--common-dialog-button-height` | 按钮圆角、高度 |
| `--common-dialog-title-size` / `--common-dialog-body-size` / `--common-dialog-action-size` | 标题、正文、按钮字号 |
| `--common-dialog-shadow-color` / `--common-dialog-dark-shadow-color` | 浅色、深色阴影 |
| `--common-dialog-button-shadow` | 按钮阴影 |

未指定时使用 TDesign 主题变量与通用尺寸。`showCancel`、`confirmText`、`cancelText`、`onConfirm`、`onCancel`、`onComplete` 延续原组件用法。

## 开发

包内 `miniprogram/` 是可直接由微信构建的 JavaScript/WXML/WXSS，入口同时提供类型声明。改共享包后，需要为使用它的小程序重新「构建 npm」。

npm 默认把 workspace 链接放在根目录。仓库 `postinstall` 会额外生成 app 本地链接，供微信开发者工具构建；如果安装时使用了 `--ignore-scripts`，需手动运行 `npm run link:workspaces`。

测试：`node --test packages/common-dialog/test/dialog.test.cjs`。
