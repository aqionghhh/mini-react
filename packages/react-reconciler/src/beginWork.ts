// 递归中的递阶段

import { ReactElementType } from "shared/ReactTypes";
import { FiberNode, OffscreenProps, createFiberFromFragment, createFiberFromOffscreen, createWorkInProgress } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { HostComponent, HostRoot, HostText, FunctionComponent, Fragment, ContextProvider, SuspenseComponent, OffscreenComponent, MemoComponent } from "./workTags";
import { cloneChildFibers, mountChildFibers, reconcileChildFibers } from "./childFibers";
import { bailoutHook, renderWithHooks } from "./fiberHooks";
import { Lane, NoLanes, includeSomeLanes } from "./fiberLanes";
import { ChildDeletion, DidCapture, NoFlags, Placement, Ref } from "./fiberFlags";
import { prepareToReadContext, propagateContextChange, pushProvider } from "./fiberContext";
import { pushSuspenseHandler } from "./suspenseContext";
import { shallowEqual } from "shared/shallowEqual";

// 表示是否能命中bailout
let didReceiveUpdate = false;  // 为false表示能命中bailout策略

export function markWipReceivedUpdate() {
  didReceiveUpdate = true;  // 没有命中
}

// 比较，然后生成子fiberNode并返回
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  console.log('beginWork', wip);

  // bailout策略
  didReceiveUpdate = false; // 每次开始时都需要重置（因为如果有机会改为true的话，就一直无法命中了）
  const current = wip.alternate;
  // 判断是否满足bailout的四要素
  if (current !== null) {  // 
    const oldProps = current.memoizedProps;
    const newProps = wip.pendingProps;
    // 全等比较（如果一个父节点没有命中bailout的话，那么它的子组件是通过reconcile生成的，reconcile生成的话，component props就是一个全新的对象，全等比较的话会不相等）
    // React.memo：让「props的全等比较」变为「props的浅比较」
    if (oldProps !== newProps || current.type !== wip.type) {  // 四要素之二：props比较、type比较
      // 不能命中
      didReceiveUpdate = true;
    } else {
      // 接下来比较state和context
      const hasScheduledStateOrContext = checkoutScheduledUpdateOrContext(current, renderLane);
      if (!hasScheduledStateOrContext) {  // 四要素中的state和context不变
        // 命中bailout
        didReceiveUpdate = false;

        // context、suspense涉及到入栈出栈的操作
        switch (wip.tag) {
          case ContextProvider:
            const newValue = wip.memoizedProps.value;
            const context = wip.type._context;
            pushProvider(context, newValue);
            break;
        
          // TODO Suspense
          default:
            break;
        }

        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }

  wip.lanes = NoLanes;  // 需要在beginWork中消费lanes

  // 在上述情况中没有满足四要素的话，也会存在某些情况下满足bailout（HostRoot、FunctionComponent）
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
      return updateFunctionComponent(wip, wip.type, renderLane);  // 传入renderLane的原因：FunctionComponent可以触发更新
    case Fragment:
      return updateFragment(wip);
    case ContextProvider:
      return updateContextProvider(wip, renderLane);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateOffscreenComponent(wip);
    case MemoComponent:
      return updateMemoComponent(wip, renderLane);
    default:
      if (__DEV__) {
        console.warn('beginWork未实现的类型');
      }
      break;
  }
  return null;
}

// Memo
function updateMemoComponent(wip: FiberNode, renderLane: Lane) {
  // bailout四要素
  // props浅比较
  const current = wip.alternate;
  const nextProps = wip.pendingProps;
  const Component = wip.type.type;

  if (current !== null) {
    const prevProps = current.memoizedProps;
    // 浅比较props  
    if (shallowEqual(prevProps, nextProps) && current.ref === wip.ref) {
      didReceiveUpdate = false; // 命中bailout
      wip.pendingProps = prevProps;

      // state context
      if (!checkoutScheduledUpdateOrContext(current, renderLane)) {
        // 满足四要素
        wip.lanes = current.lanes;
        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }
  return updateFunctionComponent(wip, Component, renderLane);
}

// bailout策略
function bailoutOnAlreadyFinishedWork(wip: FiberNode, renderLane: Lane) {
  // 命中「性能优化」（bailout策略）的组件可以不通过reconcile生成wip.child，而是直接复用上次更新生成的wip.child

  // 命中bailout策略后还需要判断优化程度，是否可以跳过所有子树的beginWork
  if (!includeSomeLanes(wip.childLanes, renderLane)) { // 检查wip的整棵子树是否能满足四要素，如果wip的子树也满足，那么所有子树都不需要重新render了
    if (__DEV__) {
      console.warn('bailout整棵子树', wip);
    }
    return null;  // 不需要继续beginWork了  // beginWork中返回null，代表着这是已经遍历到了叶子节点，递的过程已经结束，可以往上遍历了
  }

  if (__DEV__) {
    console.warn('bailout一个fiber', wip);  // 只命中了wip这一个fiber
  }
  cloneChildFibers(wip);
  return wip.child;
}

// bailout策略中的state和context比较
function checkoutScheduledUpdateOrContext(current: FiberNode, renderLane: Lane): boolean { // 这里为什么用current而不是wip：因为这个检查的方法是在beginWork中执行，而在beginWork开始的时候会将wip.lanes都消耗完，这里如果取wip，那么wip的lanes就是NoLanes；所以要取current
  const updateLanes = current.lanes;

  if (includeSomeLanes(updateLanes, renderLane)) {  // 当前fiber中未执行的更新里 是否包含了本次更新对应的lane
    // 包含，存在更新
    return true;
  }
  return false;
}

function updateSuspenseComponent(wip: FiberNode) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;

  // 需要判断当前是正常流程还是挂起流程
  let showFallback = false; // 是否展示fallback
  const didSuspend = (wip.flags & DidCapture) !== NoFlags; // 表示当前是否为挂起状态

  if (didSuspend) { // 当前为挂起状态 
    showFallback = true;
    wip.flags &= ~DidCapture;
  }

  const nextPrimaryChildren = nextProps.children; // 对应的offscreen
  const nextFallbackChildren = nextProps.fallback;  // 对应的fallback

  pushSuspenseHandler(wip);

  if (current === null) { // mount流程
    if (showFallback) { // mount的挂起流程
      return mountSuspenseFallbackChildren(wip, nextPrimaryChildren, nextFallbackChildren);
    } else { // mount的正常流程
      return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  } else {
    if (showFallback) { // update的挂起流程
      return updateSuspenseFallbackChildren(wip, nextPrimaryChildren, nextFallbackChildren);
    } else {  // update的正常流程
      return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  }
}

// update时的正常流程
function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null = currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  }; // offscreen对应的props
  
  const primaryChildFragment = createWorkInProgress(currentPrimaryChildFragment, primaryChildProps); // 复用primaryChildFragment

  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = null;
  wip.child = primaryChildFragment;

  if (currentFallbackChildFragment !== null) {  // 移除fallback
    const deletions = wip.deletions;
    if (deletions === null) {
      wip.deletions = [currentFallbackChildFragment];
      wip.flags |= ChildDeletion;
    } else {
      deletions.push(currentFallbackChildFragment);
    }
  }

  return primaryChildFragment;
}

// update时的挂起流程
function updateSuspenseFallbackChildren(wip: FiberNode, primaryChildren: any, fallbackChildren: any) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null = currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  }; // offscreen对应的props
  
  const primaryChildFragment = createWorkInProgress(currentPrimaryChildFragment, primaryChildProps); // 复用primaryChildFragment
  let fallbackChildFragment
  if (currentFallbackChildFragment !== null) {  // 之前创建过了fallbackChildFragment，可以复用
    fallbackChildFragment = createWorkInProgress(currentFallbackChildFragment, fallbackChildren); // 复用fallbackChildFragment
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null); // 创建fallback对应的fiber
    fallbackChildFragment.flags |= Placement;
  }

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

// mount时的正常流程
function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  }; // offscreen对应的props
  
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps); // 创建Offscreen对应的fiber
  // 为什么这里不需要创建fallbackChildFragment：因为不知道何时会渲染该 Suspense对应的fallback
  // 所以在渲染fallback之前没有必要提前创建fallbackChildFragment的fiber，在渲染Fragment的时候创建fallbackChildFragment对应的fiber就行了

  wip.child = primaryChildFragment;
  primaryChildFragment.return = wip;

  return primaryChildFragment;
}

// mount时的挂起流程
function mountSuspenseFallbackChildren(wip: FiberNode, primaryChildren: any, fallbackChildren: any) {
  // 虽然返回的是Fragment的fallback，但是还需要创建offscreen
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  }; // offscreen对应的props
  
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps); // 创建Offscreen对应的fiber
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null); // 创建fallback对应的fiber

  // 需要考虑下什么情况会进入这个函数：从正常状态进入到挂起状态时
  // 因为对应的Fragment需要挂载，但是其shouldTrackEffects始终为false，且父组件Suspense已经挂载了不可能为null；
  // 所以需要手动标记Placement，插入对应的dom，否则切换时，fallback的dom是不会被插入的
  fallbackChildFragment.flags |= Placement;

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

function updateOffscreenComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;

  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function updateContextProvider(wip: FiberNode, renderLane: Lane) {
  // 先获取provideType
  const provideType = wip.type; // 获取到的是一个对象
  const context = provideType._context;
  const newProps = wip.pendingProps;
  const oldProps = wip.memoizedProps;
  const newValue = newProps.value;

  pushProvider(context, newValue);

  if (oldProps !== null) {
    const oldValue = oldProps.value;
    if (Object.is(oldValue, newValue) && oldProps.children === newProps.children) { // 判断context的value值是否发生变化
      // value值没变，且children相等
      // 命中context的bailout
      return bailoutOnAlreadyFinishedWork(wip, renderLane);
    } else {  // value发生变化
      // 需要向下寻找依赖了当前context的函数组件，并标记childLanes
      propagateContextChange(wip, context, renderLane);
    }
  }

  const nextChildren = newProps.children;
  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(wip: FiberNode, Component: FiberNode['type'], renderLane: Lane ) { // renderLane代表本次更新的lane
  prepareToReadContext(wip, renderLane); // context相关：重置指向最后一个ContextItem的全局变量

  // render（renderWithHooks会进行状态计算，状态计算时会判断是否命中bailout，标记didReceiveUpdate）
  const nextChildren = renderWithHooks(wip, Component, renderLane);  // 这里的nextChildren就是函数组件执行完成的结果（函数组件中return出来的内容）

  const current = wip.alternate;
  if (current !== null && !didReceiveUpdate) {  // update && 命中bailout
    // 跟hooks相关的东西需要进行重置
    bailoutHook(wip, renderLane);

    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }

  reconcilerChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) { // renderLane代表本次更新的lane
  const baseState = wip.memoizedState; // 首屏渲染时不存在该值
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending; // 参与计算的update
  updateQueue.shared.pending = null;  // 计算完成之后，这个值就没有用了，所以赋值为null

  const prevChildren = wip.memoizedState;

  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane); // memoizedState是当前hostRootFiber最新的状态
  // 对于hostRootFiber，创建update的时候，传入的是element；ReactDOM.createRoot(root).render(<APP/>)，<APP/>对应的ReactElement就是这个element
  // 当前计算出来的memoizedState不是一个函数，所以计算出来的memoizedState就是传入的ReactElement
  wip.memoizedState = memoizedState;  

  const current = wip.alternate;  // 在mount阶段时，suspense的场景下，可能存在有fiber被挂起的情况，这样是无法走到commit阶段的，对应的fiber树没有建出来，所以在update时，alternate为空
  if (current !== null) {
    if (!current.memoizedState) {
      current.memoizedState = memoizedState;
    }
  }

  const nextChildren = wip.memoizedState;

  if (prevChildren === nextChildren) {  // 这种情况可以认为HostRoot命中bailout
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }
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