// React
import currentDispatcher, { Dispatcher, resolveDispatcher } from './src/currentDispatcher';
import { jsxDEV } from './src/jsx';

// 使用的hooks都是从React包中暴露出去的
export const useState: Dispatcher['useState'] = (initialState) => {
  // 获取Dispatcher中的useState
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

// 内部的数据共享层（变量名字可以自己取）
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher
};

export default {
  version: '0.0.0', // 版本
  createElement: jsxDEV
};
