const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
function dialog() {
  let definition;
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/dialog/index.js'), 'utf8'), {
    Component: value => { definition = value; },
    wx: { getSystemInfoSync: () => ({ theme: 'light' }) },
  });
  return Object.assign({
    data: { ...definition.data }, properties: { theme: '', themeStyle: '' },
    setData(patch) { Object.assign(this.data, patch); },
  }, definition.methods);
}
test('theme is provided by the consuming app; per-call overrides remain available', () => {
  const instance = dialog();
  instance.properties.theme = 'dark';
  instance.properties.themeStyle = '--common-dialog-radius:20rpx;';
  instance.open({ title: '结果', content: '答对了', customStyle: '--common-dialog-confirm-bg:blue;' });
  assert.equal(instance.data.currentTheme, 'dark');
  assert.equal(instance.data.dialogStyle, '--common-dialog-radius:20rpx;--common-dialog-confirm-bg:blue;');
  instance.open({ title: '结果', content: '答对了', theme: 'light' });
  assert.equal(instance.data.currentTheme, 'light');
});
test('confirm and complete run once even when repeated close events arrive', () => {
  const instance = dialog();
  const calls = [];
  instance.open({ title: '结果', content: '答对了', onConfirm: () => calls.push('confirm'), onComplete: () => calls.push('complete') });
  instance.onConfirm(); instance.onConfirm(); instance.onClose();
  assert.deepEqual(calls, ['confirm', 'complete']);
  assert.equal(instance.data.visible, false);
});
test('cancel does not invoke confirm and supports a subsequent score dialog', () => {
  const instance = dialog();
  const calls = [];
  instance.open({ title: '退出', content: '确认？', showCancel: true, onCancel: () => calls.push('cancel'), onConfirm: () => calls.push('confirm') });
  instance.onCancel();
  assert.deepEqual(calls, ['cancel']);
  instance.open({ title: '最后一题', content: '答对了', onConfirm: () => instance.open({ title: '总分', content: '100 分' }) });
  instance.onConfirm();
  assert.equal(instance.data.visible, true);
  assert.equal(instance.data.title, '总分');
});
test('shared showCommonDialog forwards options to the page component', () => {
  const { showCommonDialog } = require('../miniprogram/index.js');
  const options = { title: '结果', content: '答对了' };
  let received;
  showCommonDialog({ selectComponent: selector => {
    assert.equal(selector, '#common-dialog');
    return { open: value => { received = value; } };
  } }, options);
  assert.equal(received, options);
});
