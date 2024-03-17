import generatePackageJson from 'rollup-plugin-generate-package-json';
import { 
  getPackageJSON, 
  resolvePkgPath, 
  getBaseRollupPlugins, 
} from './utils';

const { name, module } = getPackageJSON('react'); // 读文件夹名为react包的package.json
const pkgPath = resolvePkgPath(name); // react的包路径
const pkgDistPath = resolvePkgPath(name, true); // react的产物路径

export default [
  // react包
  {
    input:  `${pkgPath}/${module}`,  // 输入文件
    output: {
      file: `${pkgDistPath}/index.js`, // 输出文件
      name: 'React', // 之前这里写的index.js，这是不对的，因为这是umd的包（如果是esm的包可以这么写），在浏览器中通过window来取的话，当前这个包的名字不叫window.React，而是window['index.js']
      format: 'umd',  // 格式（需要兼容commonjs和es-module的格式）
    },
    plugins: [...getBaseRollupPlugins(), generatePackageJson({
      inputFolder: pkgPath, // 输入
      outputFolder: pkgDistPath,  // 输出
      baseContents: ({name, description, version}) => ({  // 自定义字段
        name, 
        description, 
        version,
        main: 'index.js', // 输出产物的入口
      })

    })], // 打包过程中使用的插件
  },
  {
    input:  `${pkgPath}/src/jsx.ts`,  // 输入文件
    output: [
      // jsx-runtime
      {
        file: `${pkgDistPath}/jsx-runtime.js`, // 输出文件
        name: 'jsx-runtime', // 之前这里写的jsx-runtime.js，这是不对的，因为这是umd的包（如果是esm的包可以这么写），在浏览器中通过window来取的话，当前这个包的名字不叫window.['jsx-runtime']，而是window['jsx-runtime.js']
        format: 'umd',  // 格式（需要兼容commonjs和es-module的格式）
      },
      // jsx-dev-runtime
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`, // 输出文件
        name: 'jsx-dev-runtime', // 之前这里写的jsx-dev-runtime.js，这是不对的，因为这是umd的包（如果是esm的包可以这么写），在浏览器中通过window来取的话，当前这个包的名字不叫window.['jsx-dev-runtime']，而是window['jsx-dev-runtime.js']
        format: 'umd',  // 格式（需要兼容commonjs和es-module的格式）
      },
    ],
    plugins: getBaseRollupPlugins(), // 打包过程中使用的插件
  }
]