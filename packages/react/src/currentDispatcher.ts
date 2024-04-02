// 用于实现内部的数据共享层(dispatcher: 当前使用的Hooks集合)

import { HookDeps } from "react-reconciler/src/fiberHooks";
import { Action, ReactContext, Usable } from "shared/ReactTypes";

export interface Dispatcher {
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>]; // initialState接收函数或者参数T，返回一个数组
  useEffect: (callback: () => void | void, deps: HookDeps | undefined) => void;
  useTransition: () => [boolean, (callback: () => void) => void];
  useRef: <T>(initialValue: T) => { current: T };
  useContext: <T>(context: ReactContext<T>) => T; 
  use: <T>(usable: Usable<T>) => T;
  useMemo: <T>(nextCreate: () => T, deps: HookDeps | undefined) => void;
  useCallback: <T>(callback: T, deps: HookDeps | undefined) => void;
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = {
  current: null,
};

export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;

  if (dispatcher === null) {
    // 如果不在函数组件的上下文中，那么dispatcher是没有被赋值的
    throw new Error('hook只能在函数组件中执行');
  }

  return dispatcher;
}

export default currentDispatcher;
