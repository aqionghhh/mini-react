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
      name: 'index.js',
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
        name: 'jsx-runtime.js',
        format: 'umd',  // 格式（需要兼容commonjs和es-module的格式）
      },
      // jsx-dev-runtime
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`, // 输出文件
        name: 'jsx-dev-runtime.js',
        format: 'umd',  // 格式（需要兼容commonjs和es-module的格式）
      },
    ],
    plugins: getBaseRollupPlugins(), // 打包过程中使用的插件
  }
]