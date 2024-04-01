// 用一个栈结构来获取最近的一个suspense

import { FiberNode } from "./fiber";

const suspenseHandlerStack: FiberNode[] = [];

export function getSuspenseHandler(){
  return suspenseHandlerStack[suspenseHandlerStack.length - 1];
}

export function pushSuspenseHandler(handle: FiberNode) {
  suspenseHandlerStack.push(handle);
}

export function popSuspenseHandler() {
  suspenseHandlerStack.pop();
}
