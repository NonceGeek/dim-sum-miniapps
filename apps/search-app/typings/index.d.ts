/// <reference path="./types/index.d.ts" />
import type { BaseGlobalData } from '@dim-sum/app-types'

declare global {
  interface IAppOption {
    globalData: BaseGlobalData<WechatMiniprogram.UserInfo>
  }
}
