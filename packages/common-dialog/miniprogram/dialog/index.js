Component({
  properties: { theme: { type: String, value: "" }, themeStyle: { type: String, value: "" } },
  data: {
    visible: false,
    dialogStyle: "",
    currentTheme: "light",
    title: "",
    content: "",
    showCancel: false,
    confirmBtn: {
      content: "确定",
      variant: "base",
      theme: "primary",
      shape: "round",
      size: "medium",
      hoverClass: "none",
    },
    cancelBtn: false,
    overlayProps: {
      zIndex: 13999,
      style: "--td-overlay-bg-color: rgba(0, 0, 0, 0.52);",
    },
  },

  methods: {
    open(options) {
      const currentTheme = options.theme || this.properties.theme || (wx.getSystemInfoSync().theme === "dark" ? "dark" : "light");
      const showCancel = options.showCancel ?? Boolean(options.cancelText);
      this._dialogOptions = options;
      this._dialogSettled = false;
      this.setData({
        visible: true,
        dialogStyle: this.properties.themeStyle + (options.customStyle || ""),
        currentTheme,
        title: options.title,
        content: options.content,
        showCancel,
        confirmBtn: {
          content: options.confirmText || "确定",
          variant: "base",
          theme: "primary",
          shape: "round",
          size: "medium",
          hoverClass: "none",
        },
        cancelBtn: showCancel
          ? {
              content: options.cancelText || "取消",
              variant: "outline",
              theme: "default",
              shape: "round",
              size: "medium",
              hoverClass: "none",
            }
          : false,
        overlayProps: {
          zIndex: 13999,
          style: `--td-overlay-bg-color: ${
            currentTheme === "dark"
              ? "rgba(0, 0, 0, 0.68)"
              : "rgba(0, 0, 0, 0.52)"
          };`,
        },
      });
    },

    settle(confirmed) {
      if (this._dialogSettled) return;
      this._dialogSettled = true;
      const options = this._dialogOptions;
      this._dialogOptions = undefined;
      this.setData({ visible: false });
      if (confirmed) {
        options?.onConfirm?.();
      } else {
        options?.onCancel?.();
      }
      options?.onComplete?.();
    },

    onConfirm() {
      this.settle(true);
    },

    onCancel() {
      this.settle(false);
    },

    onClose() {
      this.settle(false);
    },
  },
});
