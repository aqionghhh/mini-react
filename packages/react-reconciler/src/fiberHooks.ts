import internals from "shared/internals";
import { Action } from "shared/ReactTypes";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import { FiberNode } from "./fiber";
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from "./updateQueue";
import { scheduleUpdateOnFiber } from "./workLoop";

let currentlyRenderingFiber: FiberNode | null = null; // 当前正在render的fiber
let workInProgressHook: Hook | null = null; // 指向当前正在处理的hook（当前正在进入一个FC的beginWork阶段时，会处理当前链表中的每一个hook，需要一个指针来指向正在处理的hook）

const { currentDispatcher } = internals;

interface Hook {  // 它的数据结构要满足所有hooks（useEffect、useMemo...）
  memoizedState: any; // 如果当前的hook是useState的话，memoizedState就是它保存的状态；对于不同的hook，它的memoizedState定义是不一样的
  updateQueue: unknown;
  next: Hook | null;  // next指向下一个hook
}

export function renderWithHooks(wip: FiberNode) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  wip.memoizedState = null; // 设为null是因为在下面的操作中，会创建这条hooks链表

  const current = wip.alternate;
  if (current !== null) { // update阶段

  } else {  // mount阶段
    // reconciler进行到mount阶段时，就对应了一个mount阶段hooks实现的集合；
    // 将当前集合HooksDispatcherOnMount指向当前使用的hooks集合，也就是currentDispatcher.current指向HooksDispatcherOnMount
    currentDispatcher.current = HooksDispatcherOnMount; 
  }

  // 对于一个函数组件，它的函数保存在wip.type上
  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState
};

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = mountWorkInProgressHook();
  let memoizedState;

  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState; // 将initialState保存在hook.memoizedState中
  
  // 用bind的原因：比如说在App组件中定义一个状态，dispatch方法名为setNum，这个setNum可以脱离函数组件使用（比如说绑在window对象上，然后可以在控制台或组件外部使用），也是可以触发函数组件的更新的
  // 因为在dispatchSetState方法中，已经保存了对应的fiber节点，所以可以用bind来调用实现
  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue); 
  queue.dispatch = dispatch;
  return [memoizedState, dispatch];
};

function dispatchSetState<State>(
  fiber: FiberNode, 
  updateQueue: UpdateQueue<State>, 
  action: Action<State>
) {
  // 既然是要触发更新，那就创建一个update
  const update = createUpdate(action);
  enqueueUpdate(updateQueue, update); // 将update插入到updateQueue中 
  scheduleUpdateOnFiber(fiber);  // 从当前触发更新的（也就是FC对应）fiber开始调度更新
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {  // 创建hook数据
    memoizedState: null,
    updateQueue: null,
    next: null
  };
  if (workInProgressHook === null) {  // mount阶段，且为第一个hook
    if(currentlyRenderingFiber === null) {  // 进入到mount阶段，执行了mountState函数，但是currentlyRenderingFiber为null；代表没有在函数组件内调用hook
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook; // memoizedState指向mount时的第一个hook
    }
  } else {  // mount时后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}