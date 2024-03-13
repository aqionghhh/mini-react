import ReactDomConfig from './react-dom.config';
import ReactConfig from './react.config';

// 将两个包合并到一块
export default () => {
  return [...ReactConfig, ...ReactDomConfig];
}