// React
import currentDispatcher, { Dispatcher, resolveDispatcher } from './src/currentDispatcher';
import ReactCurrentBatchConfig from './src/currentBatchConfig';
import { jsxDEV, jsx, isValidElement as isValidElementFn } from './src/jsx';

// 使用的hooks都是从React包中暴露出去的
export const useState: Dispatcher['useState'] = (initialState) => {
  // 获取Dispatcher中的useState
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  // 获取Dispatcher中的useState
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export const useTransition: Dispatcher['useTransition'] = () => {
  // 获取Dispatcher中的useState
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
}

// 内部的数据共享层（变量名字可以自己取）
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  ReactCurrentBatchConfig
};

export const version = '0.0.0';
export const isValidElement = isValidElementFn;

// TODO 根据环境区分使用jsx/jsxDEV
export const createElement = jsx;
