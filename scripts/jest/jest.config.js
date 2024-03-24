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
  testEnvironment: 'jsdom',
  moduleNameMapper: { // 在jest测试的情况下，需要将scheduler包指向测试环境下的调度器
    '^scheduler$': '<rootDir>/node_modules/scheduler/unstable_mock.js'
  },
  fakeTimers: { // 指定假的计时器
    enableGlobally: true,
    legacyFakeTimers: true
  },
  setupFilesAfterEnv: ['./scripts/jest/setupJest.js'] // 指定matchers的目录
};
