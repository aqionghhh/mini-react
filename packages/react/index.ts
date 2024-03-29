// React
import currentDispatcher, { Dispatcher, resolveDispatcher } from './src/currentDispatcher';
import ReactCurrentBatchConfig from './src/currentBatchConfig';
import { jsxDEV, jsx, isValidElement as isValidElementFn } from './src/jsx';
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols';
export { createContext } from './src/context';

// 使用的hooks都是从React包中暴露出去的
export const useState: Dispatcher['useState'] = (initialState) => {
  // 获取Dispatcher中的useState
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  // 获取Dispatcher中的useEffect
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export const useTransition: Dispatcher['useTransition'] = () => {
  // 获取Dispatcher中的useTransition
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
}

export const useRef: Dispatcher['useRef'] = (initialValue) => {
  // 获取Dispatcher中的useRef
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export const useContext: Dispatcher['useContext'] = (context) => {
  // 获取Dispatcher中的useContext
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(context);
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
