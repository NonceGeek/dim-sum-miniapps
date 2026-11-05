Component({
  properties: {
    visible: Boolean,
    types: Array,
    selectedIndex: Number,
    text: String,
    submitting: Boolean,
  },
  methods: {
    onContentTap() {},
    onClose() {
      if (!this.data.submitting) this.triggerEvent('close')
    },
    onTypeTap(event: WechatMiniprogram.BaseEvent) {
      if (!this.data.submitting) {
        this.triggerEvent('typechange', { index: Number(event.currentTarget.dataset.index) })
      }
    },
    onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      if (!this.data.submitting) this.triggerEvent('textchange', { value: event.detail.value })
    },
    onSubmit() {
      if (!this.data.submitting) this.triggerEvent('submit')
    },
  },
})
