// 微信开发者工具在小程序本地 node_modules 中查找 npm 组件。
// npm 将 workspace 链接放在仓库根目录，这里为已声明的共享依赖补充本地链接。
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const packages = new Map();
for (const entry of readdirSync(resolve(root, 'packages'), { withFileTypes: true })) {
  const folder = resolve(root, 'packages', entry.name);
  if (!entry.isDirectory() || !existsSync(resolve(folder, 'package.json'))) continue;
  packages.set(readJson(resolve(folder, 'package.json')).name, folder);
}
for (const entry of readdirSync(resolve(root, 'apps'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const app = resolve(root, 'apps', entry.name);
  const pkg = readJson(resolve(app, 'package.json'));
  for (const name of Object.keys(pkg.dependencies || {})) {
    const target = packages.get(name);
    if (!target) continue;
    const link = resolve(app, 'node_modules', name);
    if (existsSync(link)) {
      if (realpathSync(link) !== realpathSync(target)) throw new Error(`${link} 不是当前共享包，拒绝覆盖`);
      continue;
    }
    try { lstatSync(link); throw new Error(`${link} 是失效链接，请先移除后重试`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(relative(dirname(link), target), link, 'dir');
    console.log(`${entry.name}: ${name}`);
  }
}
