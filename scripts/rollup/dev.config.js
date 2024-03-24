import ReactDomConfig from './react-dom.config';
import ReactNoopRendererConfig from './react-noop-renderer.config';
import ReactConfig from './react.config';

// 将两个包合并到一块
export default () => {
  return [...ReactConfig, ...ReactDomConfig, ...ReactNoopRendererConfig];
}