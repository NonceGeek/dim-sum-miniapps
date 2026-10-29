const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { stripTypeScriptTypes } = require('node:module')
const nativeModelSource = stripTypeScriptTypes(fs.readFileSync(require.resolve('../miniprogram/components/native-model/index.ts'), 'utf8'))
const { resolveModelSource } = vm.runInNewContext(`${nativeModelSource}\n;({ resolveModelSource })`, { Component() {} })

test('model sources use API-provided HTTPS files without viewer mappings', () => {
  assert.equal(resolveModelSource('https://oss.aidimsum.com/vox-ship/'), '')
  assert.equal(resolveModelSource('https://example.com/model.glb?signature=abc'), 'https://example.com/model.glb?signature=abc')
  assert.equal(resolveModelSource('https://example.com/model.gltf'), 'https://example.com/model.gltf')
  for (const source of ['http://example.com/model.glb', 'https://example.com/viewer', 'https://evil.example/vox-ship', '', null]) assert.equal(resolveModelSource(source), '')
})

function frame() {
  let definition
  const ticks = []
  vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync(require.resolve('../miniprogram/components/model-scene/index.ts'), 'utf8')), {
    Component: value => { definition = value }, wx: { nextTick: callback => ticks.push(callback) }, console,
    setTimeout: () => 0,
  })
  const events = []
  const instance = { ...definition.methods, data: structuredClone(definition.data), triggerEvent: (type, detail) => events.push({ type, detail }) }
  instance.setData = value => Object.assign(instance.data, value)
  return { instance, definition, ticks, events }
}

test('native camera framing centers an off-origin model and fits its extent once', () => {
  const { instance, ticks, events } = frame()
  instance.scene = { getElementById: () => ({ getComponent: () => ({ calcTotalBoundBox: () => ({ center: { x: 10, y: 5, z: -4 }, size: { x: 22, y: 11, z: 4 } }) }) }) }
  instance.onModelLoaded()
  instance.onModelLoaded()
  assert.equal(ticks.length, 1)
  ticks.shift()()
  assert.equal(instance.data.modelScale, '0.1 0.1 0.1')
  assert.equal(instance.data.modelPosition, '-1 -0.5 0.4')
  assert.equal(events[0].type, 'loaded')
})

test('detaching prevents a late assets-complete event from rebuilding the model', () => {
  const { instance, definition } = frame()
  instance.data.assetSource = 'https://example.com/model.glb'
  definition.lifetimes.detached.call(instance)
  instance.onAssetsLoaded()
  assert.equal(instance.data.loaded, false)
})

test('scrolling repositions a visible scene without destroying it, and hides clipped scenes', () => {
  let definition
  let resume
  vm.runInNewContext(nativeModelSource, {
    Component: value => { definition = value },
    wx: { getSystemInfoSync: () => ({ pixelRatio: 2, windowHeight: 800 }) },
    setTimeout: callback => { resume = callback; return 1 }, clearTimeout() {},
  })
  const instance = { ...definition.methods, data: { ...definition.data, source: 'https://example.com/model.glb', active: true, viewportTop: 80, viewportBottom: 700 }, mounted: true, inViewport: true }
  instance.setData = data => Object.assign(instance.data, data)
  let rect = { top: 200, left: 20, width: 340, height: 220, bottom: 420 }
  instance.createSelectorQuery = () => ({ select() { return this }, boundingClientRect(callback) { callback(rect); return this }, exec() {} })
  instance.schedulePositionUpdate()
  assert.equal(instance.data.active, true)
  resume()
  assert.equal(instance.data.active, true)
  assert.equal(instance.data.displayTop, 200)
  assert.equal(instance.data.displayLeft, 20)
  instance.schedulePositionUpdate()
  rect = { ...rect, top: 20, bottom: 240 }
  resume()
  assert.equal(instance.data.active, false, 'a partially clipped scene cannot cover the search header')
})
