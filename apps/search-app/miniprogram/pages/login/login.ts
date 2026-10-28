import { applyAppearance } from "../../utils/appearance";
const ENV = { title: '粤语随手查', subtitle: '查一句，学一句。', VERSION: '1.0.0' };
const { miniProgram } = wx.getAccountInfoSync();

function getLoginErrorMessage(error: any, fallback: string): string {
  const candidates = [error?.message, error?.errMsg, error?.error?.message, error?.error, error];
  const message = candidates.find(value => typeof value === "string" && value.trim() && value !== "[object Object]");
  if (!message) return fallback;
  if (/timeout|timed out|超时/i.test(message)) {
    return fallback.includes("发送") ? "验证码发送超时，请重试" : "登录超时，请重试";
  }
  if (/request:fail|network|网络/i.test(message)) return "网络连接失败，请检查网络后重试";
  return message.replace(/^Error:\s*/, "");
}

Page({
  data: {
    returnToPrevious: false,
    loading: false,
    redirectUrl: "/pages/profile/profile",
    currentTheme: "light",
    showPhonePopup: false,
    phone: "",
    code: "",
    counting: false,
    codeButtonText: "发送验证码",
    sendingCode: false,
    logining: false,
    agreedToTerms: false,
    version: miniProgram.version || `${ENV.VERSION}`,
  },

  onLoad(options: { redirect?: string; returnToPrevious?: string }) {
    this.setData({ returnToPrevious: options.returnToPrevious === '1' });
    try {
      const redirect = decodeURIComponent(options.redirect || '');
      if (redirect === '/pages/profile/profile' || redirect === '/pages/index/index') this.setData({ redirectUrl: redirect });
    } catch (error) { console.warn('登录回跳地址无效', error); }
    this.syncTheme();
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    applyAppearance(this);
    this.setData({ currentTheme: getApp<IAppOption>().globalData.theme });
  },

  async handleLogin() {
    if (this.data.loading) return;

    if (!this.data.agreedToTerms) {
      wx.showToast({
        title: "请先阅读并同意用户协议",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const app = getApp<IAppOption>();
      await app.doLogin();

      wx.showToast({
        title: "登录成功",
        icon: "success",
      });

      // Redirect to main page
      setTimeout(() => this.finishLogin(), 800);
    } catch (err: any) {
      console.error("Login failed", err);
      wx.showToast({
        title: getLoginErrorMessage(err, "登录失败，请重试"),
        icon: "none",
        duration: 2000,
      });
      this.setData({ loading: false });
    }
  },

  finishLogin() {
    if (this.data.returnToPrevious && getCurrentPages().length > 1) {
      this.getOpenerEventChannel().emit('loginSuccess');
      wx.navigateBack({ fail: () => wx.switchTab({ url: this.data.redirectUrl }) });
      return;
    }
    wx.switchTab({ url: this.data.redirectUrl, fail: () => wx.showToast({ title: '页面打开失败，请重试', icon: 'none' }) });
  },
  onCancelLogin() {
    const pages = getCurrentPages();
    const previous = pages[pages.length - 2];
    if (previous) {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index', fail: () => wx.showToast({ title: '首页打开失败', icon: 'none' }) }) });
    } else {
      wx.switchTab({ url: '/pages/index/index', fail: () => wx.showToast({ title: '首页打开失败', icon: 'none' }) });
    }
  },
  // 打开手机号登录弹窗
  handlePhoneLogin() {
    if (!this.data.agreedToTerms) { wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' }); return; }
    this.setData({ showPhonePopup: true });
  },

  // 关闭弹窗
  onPopupClose(e: any) {
    this.setData({
      showPhonePopup: e.detail.visible,
    });
  },

  // 手机号输入
  onPhoneChange(e: any) {
    this.setData({
      phone: e.detail.value,
    });
  },

  // 验证码输入
  onCodeChange(e: any) {
    this.setData({
      code: e.detail.value,
    });
  },

  // 发送验证码
  async sendCode() {
    const app = getApp<IAppOption>();
    const { phone, counting } = this.data;

    if (counting || this.data.sendingCode) return;

    // 验证手机号
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: "请输入正确的手机号",
        icon: "none",
      });
      return;
    }

    this.setData({ sendingCode: true });

    try {
      const res = await app.doSendSms(phone);
      if (!res.success) throw new Error(res.message || "验证码发送失败，请重试");
      if (res.success) {
        wx.showToast({
          title: "验证码已发送",
          icon: "success",
          duration: 2000,
        });

        // 开始倒计时
        this.setData({
          counting: true,
          sendingCode: false,
        });
      }
    } catch (err: any) {
      console.error("发送验证码失败", err);
      wx.showToast({
        title: getLoginErrorMessage(err, "验证码发送失败，请重试"),
        icon: "none",
        duration: 2000,
      });
      this.setData({ sendingCode: false });
    }
  },

  // 倒计时结束
  onCountDownFinish() {
    this.setData({
      counting: false,
    });
  },

  // 确认手机号登录
  async confirmPhoneLogin() {
    const app = getApp<IAppOption>();
    const { phone, code, logining } = this.data;

    if (logining) return;
    if (!this.data.agreedToTerms) { wx.showToast({ title: "请先阅读并同意用户协议", icon: "none" }); return; }

    // 验证输入
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: "请输入正确的手机号",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    if (!code || code.length !== 6) {
      wx.showToast({
        title: "请输入6位验证码",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    this.setData({ logining: true });

    try {
      await app.doPhoneLogin(phone, code);

      wx.showToast({
        title: "登录成功",
        icon: "success",
        duration: 2000,
      });

      // 关闭弹窗
      this.setData({
        showPhonePopup: false,
      });

      // 跳转到主页
      setTimeout(() => this.finishLogin(), 800);
    } catch (err: any) {
      console.error("手机号登录失败", err);
      wx.showToast({
        title: getLoginErrorMessage(err, "登录失败，请重试"),
        icon: "none",
        duration: 2000,
      });
      this.setData({ logining: false });
    }
  },

  // 协议复选框变化
  onAgreementChange(e: any) {
    const checked = e.detail.checked;
    this.setData({
      agreedToTerms: checked,
    });
  },

  // 跳转到用户服务协议
  goToTerms() {
    wx.navigateTo({
      url: "/pages/webview/webview?url=https://search.aidimsum.com/terms",
      fail: () => wx.showToast({ title: "协议页面打开失败", icon: "none" }),
    });
  },

  // 跳转到隐私政策
  goToPrivacy() {
    wx.navigateTo({
      url: "/pages/webview/webview?url=https://search.aidimsum.com/privacy",
      fail: () => wx.showToast({ title: "政策页面打开失败", icon: "none" }),
    });
  },
});
