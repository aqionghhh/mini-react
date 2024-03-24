import generatePackageJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';
import { 
  getPackageJSON, 
  resolvePkgPath, 
  getBaseRollupPlugins, 
} from './utils';

const { name, module, peerDependencies } = getPackageJSON('react-dom'); // 读文件夹名为react-dom包的package.json
const pkgPath = resolvePkgPath(name); // react-dom的包路径
const pkgDistPath = resolvePkgPath(name, true); // react-dom的产物路径

export default [
  // react-dom包
  {
    input:  `${pkgPath}/${module}`,  // 输入文件
    output: [ // 为了做兼容处理（react18和react17及以前版本），需要导出成两个包
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactDOM', // 之前这里写的index.js，这是不对的，因为这是umd的包（如果是esm的包可以这么写），在浏览器中通过window来取的话，当前这个包的名字不叫window.ReactDOM，而是window['index.js']
        format: 'umd',
      },
      {
        file: `${pkgDistPath}/client.js`,
        name: 'client', // 之前这里写的client.js，这是不对的，因为这是umd的包（如果是esm的包可以这么写），在浏览器中通过window来取的话，当前这个包的名字不叫window.client，而是window.client
        format: 'umd',
      }
    ],
    external: [ // react-dom在打包的时候，xxx对于react-dom来说是一个外部的包，外部的包就不会被打入react-dom中
      ...Object.keys(peerDependencies),  // 将react包排出在外，目的是为了让两者共享数据（共享内部的数据共享层）
      'scheduler' // 调度器作为外部依赖，不能打包进react-dom中
    ],
    plugins: [
      ...getBaseRollupPlugins(), 
      // 类似webpack resolve alias的功能
      // 添加这个插件的意义(对于rollup的打包流程来说)：在react-reconciler这个包中引入了来自hostConfig导出的变量，但是需要知道这个hostConfig是指向谁，
      // 所以就需要alias来指定hostConfig指向react-dom/src/hostConfig.ts
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`, // entries中的key就包含了要替换的包名
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath, // 输入
        outputFolder: pkgDistPath,  // 输出
        baseContents: ({name, description, version}) => ({  // 自定义字段
          name, 
          description,
          version,
          peerDependencies: {
            react: version  // 让react的version和react-dom的version保持一致
          },
          main: 'index.js', // 输出产物的入口
        })
      })
    ], // 打包过程中使用的插件
  },
  // react-test-utils
  {
    input:  `${pkgPath}/test-utils.ts`,  // 输入文件
    output: [ // 为了做兼容处理（react18和react17及以前版本），需要导出成两个包
      {
        file: `${pkgDistPath}/test-utils.js`,
        name: 'testUtils.js',
        format: 'umd',
      },
    ],
    external: ['react-dom', 'react'],
    plugins: [
      ...getBaseRollupPlugins(), 
    ], // 打包过程中使用的插件
  },
]