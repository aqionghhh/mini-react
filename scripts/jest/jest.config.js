const { defaults } = require('jest-config');  // 引入默认配置

module.exports = {
  ...defaults,
  rootDir: process.cwd(), // 指定jest启动的根目录
  modulePathIgnorePatterns: ['<rootDir>/.history'], // 寻找测试用例的时候，忽略掉根目录下的.history文件
  moduleDirectories: [
    // 对于 React ReactDOM
    'dist/node_modules',
    // 对于第三方依赖
    ...defaults.moduleDirectories
  ],
  testEnvironment: 'jsdom'
};