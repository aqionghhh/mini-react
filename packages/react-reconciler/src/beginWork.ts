// 递归中的递阶段

import { ReactElementType } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { HostComponent, HostRoot, HostText, FunctionComponent, Fragment } from "./workTags";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import { Ref } from "./fiberFlags";

// 比较，然后生成子fiberNode并返回
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  switch (wip.tag) {
    case HostRoot:
      // HostRoot的beginWork工作流程： 1. 计算状态的最新值； 2. 创造子fiberNode
      return updateHostRoot(wip, renderLane);  // 传入renderLane的原因：HostRoot可以触发更新
    case HostComponent: 
      // HostComponent的beginWork工作流程： 1. 创造子fiberNode
      return updateHostComponent(wip);
    case HostText: 
      // HostText没有beginWork工作流程，因为他没有子节点
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);  // 传入renderLane的原因：FunctionComponent可以触发更新
    case Fragment:
      return updateFragment(wip);
      
    default:
      if (__DEV__) {
        console.warn('beginWork未实现的类型');
      }
      break;
  }
  return null;
}

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane ) { // renderLane代表本次更新的lane
  const nextChildren = renderWithHooks(wip, renderLane);  // 这里的nextChildren就是函数组件执行完成的结果（函数组件中return出来的内容）
  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) { // renderLane代表本次更新的lane
  const baseState = wip.memoizedState; // 首屏渲染时不存在该值
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending; // 参与计算的update
  updateQueue.shared.pending = null;  // 计算完成之后，这个值就没有用了，所以赋值为null
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane); // memoizedState是当前hostRootFiber最新的状态
  // 对于hostRootFiber，创建update的时候，传入的是element；ReactDOM.createRoot(root).render(<APP/>)，<APP/>对应的ReactElement就是这个element
  // 当前计算出来的memoizedState不是一个函数，所以计算出来的memoizedState就是传入的ReactElement
  wip.memoizedState = memoizedState;  

  const nextChildren = wip.memoizedState;
  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

// HostComponent和HostRoot的显著区别就是：HostComponent里面没有办法触发更新，所以没有更新的过程
function updateHostComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps; // 拿到子节点
  const nextChildren = nextProps.children;
  markRef(wip.alternate, wip);  // ref
  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function reconcilerChildren(wip: FiberNode, children?: ReactElementType) {
  // 对比子节点的current fiberNode与子节点的reactElement，生成子节点对应的wip fiberNode。
  const current = wip.alternate;

  if (current !== null) {
    // update流程
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {  // 只有在mount流程时会涉及大量的Placement操作，所以需要进行性能优化
    // mount流程（不希望追踪副作用）
    wip.child = mountChildFibers(wip, null, children);
  }
}

// 标记ref的方法
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref;
  
  if ((current === null && ref !== null || (current !== null && current.ref !== ref))) { // mount时存在ref；或者update时，ref的引用存在变化
    // 对ref进行标记
    workInProgress.flags |= Ref;
  }
}