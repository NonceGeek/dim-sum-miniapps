import { applyAppearance } from "../../utils/appearance";
const ENV = { title: "粤语随手查", subtitle: "查一句，学一句。", VERSION: "1.0.0", termsUrl: "", privacyUrl: "" };
const { miniProgram } = wx.getAccountInfoSync();

function decodeRedirect(rawRedirect: string): string {
  try {
    return decodeURIComponent(rawRedirect);
  } catch (err) {
    console.warn("登录回跳地址解析失败:", err);
    return "";
  }
}

Page({
  data: {
    loading: false,
    currentTheme: "light",
    agreedToTerms: false,
    title: ENV.title,
    subtitle: ENV.subtitle,
    version: miniProgram.version || `${ENV.VERSION}`,
    redirectUrl: "",
    returnToPrevious: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ returnToPrevious: options.returnToPrevious === "1" });
    const redirect = decodeRedirect(options.redirect || "");
    if (
      redirect.startsWith("/pages/") &&
      !redirect.startsWith("/pages/login/")
    ) {
      this.setData({ redirectUrl: redirect });
    }
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    applyAppearance(this);
    const mode = wx.getStorageSync("cantonese-appearance");
    const currentTheme = mode === "dark" ? "dark" : mode === "light" ? "light" : wx.getSystemInfoSync().theme || "light";
    this.setData({ currentTheme });
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
      const app = getApp<IAppOption & { doLogin?: () => Promise<void> }>();
      if (!app.doLogin) throw { error: "登录服务尚未接入" };
      await app.doLogin();

      wx.showToast({
        title: "登录成功",
        icon: "success",
      });

      const redirectUrl = this.data.redirectUrl;
      setTimeout(() => {
        if (this.data.returnToPrevious && getCurrentPages().length > 1) {
          wx.navigateBack();
        } else if (redirectUrl) {
          wx.redirectTo({ url: redirectUrl });
        } else {
          wx.reLaunch({ url: "/pages/index/index" });
        }
      }, 1500);
    } catch (err: any) {
      console.error("Login failed", err);
      wx.showToast({
        title: err.error || err.errMsg || "登录失败",
        icon: "none",
        duration: 2000,
      });
      this.setData({ loading: false });
    }
  },

  onCancelLogin() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.reLaunch({ url: "/pages/index/index" });
  },

  // 协议复选框变化
  onAgreementChange(e: any) {
    const checked = e.detail.value.length > 0;
    this.setData({
      agreedToTerms: checked,
    });
  },

  // 跳转到用户服务协议
  goToTerms() {
    if (!ENV.termsUrl) { wx.showToast({ title: "用户协议尚未配置", icon: "none" }); return; }
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(ENV.termsUrl)}`,
    });
  },

  // 跳转到隐私政策
  goToPrivacy() {
    if (!ENV.privacyUrl) { wx.showToast({ title: "隐私政策尚未配置", icon: "none" }); return; }
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(ENV.privacyUrl)}`,
    });
  },
});
