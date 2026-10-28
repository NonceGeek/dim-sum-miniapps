const tabs = [
  { icon: "search", label: "查粤语", value: "/pages/index/index" },
  { icon: "bookmark", label: "我的", value: "/pages/profile/profile" },
];

Component({
  properties: {
    appearanceStyle: { type: String, value: '' },
    fixed: { type: Boolean, value: true },
    navigateOnActive: { type: Boolean, value: false },
  },
  data: {
    value: "/pages/index/index",
    hidden: false,
    tabs,
  },

  methods: {
    onChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      const url = event.detail.value;

      if (!url || (url === this.data.value && !this.properties.navigateOnActive)) {
        return;
      }

      wx.switchTab({
        url,
        fail: () => {
          wx.showToast({ title: "页面切换失败", icon: "none" });
        },
      });
    },
  },
});

export {};
