import path from 'path';
import fs from 'fs';

import ts from 'rollup-plugin-typescript2';
import cjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkgPath = path.resolve(__dirname, '../../packages');  // 包路径
// 打包产物的路径
const distPath = path.resolve(__dirname, '../../dist/node_modules');  // 指定node_modules的原因：产物中会有很多包，按照node_modules的规范，是要放在node_modules下

// 解析包路径
export function resolvePkgPath(pkgName, isDisk) {
	// isDisk用于判断是否是打包后的路径（产物的路径）
  if(isDisk) {
    return `${distPath}/${pkgName}`;  // 直接返回包的产物路径
  }

  return `${pkgPath}/${pkgName}`;
}

export function getPackageJSON(pkgName) {  // 接收一个包名，返回对应包的配置
  // 找到packages下每个包的package.json路径
  const path = `${resolvePkgPath(pkgName)}/package.json`;
  const str = fs.readFileSync(path, {encoding: 'utf-8'}); // 把文件内容读成字符串
  return JSON.parse(str);
}

// 获取所有的基础plugins
export function getBaseRollupPlugins({
  alias = { // 为开发环境增加__DEV__标识
    __DEV__: true
  },
  typescript = {} // rollup-plugin-typescript2插件需要传参
} = {}) {
  return [replace(alias), cjs(), ts(typescript)]; // 执行plugin
}
