export type WorkTag = 
  typeof FunctionComponent | 
  typeof HostRoot | 
  typeof HostComponent | 
  typeof HostText | 
  typeof Fragment | 
  typeof ContextProvider |
  typeof SuspenseComponent |
  typeof OffscreenComponent |
  typeof MemoComponent;

// fiber节点的tag属性
export const FunctionComponent = 0; // 
export const HostRoot = 3;  // 项目挂载的根节点（例如ReactDOM.createRoot()挂载的根节点对应的fiber节点类型）
export const HostComponent = 5; // 例如一个div对应的fiber节点类型
export const HostText = 6;  // 例如div下的一个文本
export const Fragment = 7;  // Fragment
export const ContextProvider = 8;  // Context

export const SuspenseComponent = 13;  // Suspense
export const OffscreenComponent = 14;  // Suspense
export const MemoComponent = 15;  // Memo
