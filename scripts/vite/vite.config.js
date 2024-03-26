import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import replace from '@rollup/plugin-replace'
import { resolvePkgPath } from '../rollup/utils'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    replace({
      __DEV__: true,
      preventAssignment: true,  // 执行打包时的提示，不进行配置的话默认为false，所以这里使用推荐配置，改成true
    }),
  ],
  // 在测试文件中引入的类似React、ReactDOM希望引入的是packages目录下的内容，所以这里需要解析模块的依赖路径
  resolve: {
    alias: [
      {
        find: 'react',  // 如果发现引入的路径是react，就替换成resolvePkgPath('react')
        replacement: resolvePkgPath('react')
      },
      {
        find: 'react-dom',
        replacement: resolvePkgPath('react-dom')
      },
      {
        find: 'react-noop-renderer',
        replacement: resolvePkgPath('react-noop-renderer')
      },
      {
        find: 'hostConfig',
        replacement: path.resolve(resolvePkgPath('react-dom'), 'src/hostConfig.ts')
      },
    ]
  }
})
