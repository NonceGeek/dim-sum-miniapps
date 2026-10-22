function showCommonDialog(host, options) {
  const dialog = host.selectComponent && host.selectComponent('#common-dialog');
  if (!dialog || typeof dialog.open !== 'function') {
    console.error('当前页面或组件未挂载 #common-dialog');
    wx.showToast({ title: options.content || options.title, icon: 'none' });
    return;
  }
  dialog.open(options);
}
module.exports = { showCommonDialog };
