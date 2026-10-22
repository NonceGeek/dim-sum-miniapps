import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const appIds = new Set();
const names = new Set();
const apps = readdirSync(resolve(root, 'apps'), { withFileTypes: true }).filter(entry => entry.isDirectory());
assert(apps.length, 'apps/ 中至少需要一个小程序');
for (const entry of apps) {
  const appRoot = resolve(root, 'apps', entry.name);
  const pkg = readJson(resolve(appRoot, 'package.json'));
  assert(pkg.private, `${entry.name}: package.json 必须设置 private`);
  assert(pkg.name && !names.has(pkg.name), `${entry.name}: npm 包名称缺失或重复`);
  names.add(pkg.name);
  const project = readJson(resolve(appRoot, 'project.config.json'));
  assert(project.appid && !appIds.has(project.appid), `${entry.name}: AppID 缺失或重复`);
  appIds.add(project.appid);
  const source = resolve(appRoot, project.miniprogramRoot);
  assert(source.startsWith(appRoot + '/'), `${entry.name}: miniprogramRoot 必须在小程序目录内`);
  const appConfig = readJson(resolve(source, 'app.json'));
  for (const route of appConfig.pages) {
    for (const ext of ['ts', 'json', 'wxml', 'wxss']) {
      assert(existsSync(resolve(source, `${route}.${ext}`)), `${entry.name}: 缺少页面 ${route}.${ext}`);
    }
  }
  for (const relation of project.setting?.packNpmRelationList || []) {
    assert(existsSync(resolve(appRoot, relation.packageJsonPath)), `${entry.name}: npm 构建的 package.json 路径失效`);
    assert(existsSync(resolve(appRoot, relation.miniprogramNpmDistDir)), `${entry.name}: npm 构建输出目录失效`);
  }
  const config = readJson(resolve(appRoot, 'tsconfig.json'));
  assert(existsSync(resolve(appRoot, config.extends)), `${entry.name}: TypeScript 基础配置路径失效`);
  for (const dependency of Object.keys(pkg.dependencies || {})) {
    assert(existsSync(resolve(appRoot, 'node_modules', dependency, 'package.json')), `${entry.name}: 缺少本地依赖 ${dependency}，请在仓库根目录运行 npm install`);
  }
  console.log(`✓ ${entry.name}: AppID、页面、TypeScript 和 npm 构建路径正常`);
}
