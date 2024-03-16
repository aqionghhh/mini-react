import { FiberNode } from "./fiber";

export function renderWithHooks(wip: FiberNode) {
  // 对于一个函数组件，它的函数保存在wip.type上
  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);
  
  return children;
}