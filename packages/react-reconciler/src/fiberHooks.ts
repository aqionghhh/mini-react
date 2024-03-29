import internals from "shared/internals";
import { Action, ReactContext } from "shared/ReactTypes";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import ReactCurrentBatchConfig from "react/src/currentBatchConfig";
import { FiberNode } from "./fiber";
import { Update, UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue } from "./updateQueue";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Lane, NoLane, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookHasEffect, Passive } from "./hookEffectTag";

let currentlyRenderingFiber: FiberNode | null = null; // 当前正在render的fiber
let workInProgressHook: Hook | null = null; // 指向当前正在处理的hook（当前正在进入一个FC的beginWork阶段时，会处理当前链表中的每一个hook，需要一个指针来指向正在处理的hook）
let currentHook: Hook | null = null; // update阶段相关的全局变量
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

interface Hook {  // 它的数据结构要满足所有hooks（useEffect、useMemo...）
  memoizedState: any; // 如果当前的hook是useState的话，memoizedState就是它保存的状态；对于不同的hook，它的memoizedState定义是不一样的
  updateQueue: unknown;
  next: Hook | null;  // next指向下一个hook
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallBack | void;
  destroy: EffectCallBack | void;
  deps: EffectDeps;
  next: Effect | null;
}

// 函数组件的updateQueue
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lasEffect: Effect | null;  // 在传统UpdateQueue上新增了一个lasEffect字段，lasEffect指向Effect链表中的最后一个（为什么是最后一个：lasEffect.next就指向这个链表的第一个）
}

type EffectCallBack = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置hook链表
  wip.memoizedState = null; // 设为null是因为在下面的操作中，会创建这条hooks链表，memoizedState就保存创建的这条链表
  // 重置effect链表
  wip.updateQueue = null;

  renderLane = lane; 

  const current = wip.alternate;
  if (current !== null) { // update阶段
    currentDispatcher.current = HooksDispatcherOnUpdate;
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
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
  useTransition: mountTransition,
  useRef: mountRef,
  useContext: readContext,
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
  useRef: updateRef,
  useContext: readContext,
};

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;

  return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();

  return hook.memoizedState;
}

function updateEffect(create: EffectCallBack | void, deps: EffectDeps | void) {
  // 找到当前useState对应的hook数据
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallBack | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect; // 当前useEffect对应的currentHook的memoizedState就代表了当前effect在上一次更新时对应的effect
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 浅比较依赖
      const prevDeps = prevEffect.deps;
      if (areHookInputEqual(nextDeps, prevDeps)) {
        // 相等就代表依赖没有改变；不应该触发回调
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 浅比较不相等
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;  
    hook.memoizedState = pushEffect(Passive | HookHasEffect, create, destroy, nextDeps);
  }
}

function areHookInputEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (prevDeps === null || nextDeps === null) { // 比较失败
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;  // 全等就返回true
}

function mountEffect(create: EffectCallBack | void, deps: EffectDeps | void) {
  // 找到当前useState对应的hook数据
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;  // 在mount时，需要执行useEffect里的create函数

  hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps);  // mount时没有destroy，所以传入undefined
}

// Effect之间会形成一条单独的环状链表
function pushEffect(
  hookFlags: Flags, 
  create: EffectCallBack | void, 
  destroy: EffectCallBack | void, 
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null
  };
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect; // 需要形成环状链表
    updateQueue.lasEffect = effect;
  } else {  // 插入effect
    const lasEffect = updateQueue.lasEffect;
    if (lasEffect === null) {
      effect.next = effect; // 需要形成环状链表
      updateQueue.lasEffect = effect;
    } else {
      const firstEffect = lasEffect.next;
      lasEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lasEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lasEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = updateWorkInProgressHook(); 

  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const baseState = hook.baseState;
  
  const pending = queue.shared.pending;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  if (pending !== null) {
    // pending和baseQueue的update保存在current中
    if (baseQueue !== null) { // baseQueue存在
      // 与pending进行合并 eg：
      // baseQueue： b2 -> b0 -> b1 -> b2
      // pending p2 -> p0 -> p1 -> p2
      const baseFirst = baseQueue.next; // b0
      const PendingFirst = pending.next;  // p0
      baseQueue.next = PendingFirst;  // b2指向p0
      pending.next = baseFirst; // p2指向b0
      // 最后形成：p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
    }
    baseQueue = pending;
    current.baseQueue = pending;  // 保存在current中
    queue.shared.pending = null;
  }

  if (baseQueue !== null) {
    const { 
      memoizedState, 
      baseQueue: newBaseQueue, 
      baseState: newBaseState 
    } = processUpdateQueue(baseState, baseQueue, renderLane);
    hook.memoizedState = memoizedState;
    hook.baseQueue = newBaseQueue;
    hook.baseState = newBaseState;
  }
  
  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
};

function updateWorkInProgressHook(): Hook {
  // 需要考虑：hook的数据从哪来: currentHook
  // 什么情况下会调用updateWorkInProgressHook：交互阶段触发的更新（eg: onClick）、render阶段触发的更新（比如在render阶段调用的dispatch函数更新值）
  // TODO render阶段触发的更新
  let nextCurrentHook: Hook | null; // 用于保存下一个hook
  
  if (currentHook === null) { // 表示这个FC在update时的第一个hook
    const current = currentlyRenderingFiber?.alternate; // 当前正在render的函数组件对应的fiber对应的current fiber 
    if (current !== null) {
      nextCurrentHook = current?.memoizedState; // 第一次进入该函数的时候，memoizedState指向第一个hook
    } else {
      nextCurrentHook = null; // current为null标识mount阶段，但在这里不可能是mount阶段，所以是错误的边界情况
    }
  } else {// 这个FC在update时后续的hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook === null) { // 比如说这种情况：在mount时、或上一次update时，有u1、u2、u3，三个hook；在此次update时有u1、u2、u3、u4，四个hook
    throw new Error(`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`);
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState
  };
  if (workInProgressHook === null) {
    if(currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

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
  hook.baseState = memoizedState; // 之前遗留的bug
  
  // 用bind的原因：比如说在App组件中定义一个状态，dispatch方法名为setNum，这个setNum可以脱离函数组件使用（比如说绑在window对象上，然后可以在控制台或组件外部使用），也是可以触发函数组件的更新的
  // 因为在dispatchSetState方法中，已经保存了对应的fiber节点，所以可以用bind来调用实现
  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue); // 如果 bind 的第一个参数是 null 或者 undefined，this 就指向全局对象 window
  queue.dispatch = dispatch;
  return [memoizedState, dispatch];
};

function mountTransition(): [boolean, (callback: () => void) => void] {  // 第一个返回值：表示是否在pending中；第二个返回值：startTransition，是一个函数，接收一个回调函数
  const [isPending, setPending] = mountState(false);
  const hook = mountWorkInProgressHook();

  const start = startTransition.bind(null, setPending);
  hook.memoizedState = start;

  return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState();
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;

  return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  setPending(true); // 高优先级的同步更新

  // 将优先级(调度器的优先级)改为TransitionLane
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = 1;  // 设为1，改变优先级，表示当前进入了transition

  callback();
  setPending(false);

  ReactCurrentBatchConfig.transition = prevTransition;
}

function dispatchSetState<State>(
  fiber: FiberNode, 
  updateQueue: UpdateQueue<State>, 
  action: Action<State>
) {
  const lane = requestUpdateLane();
  // 既然是要触发更新，那就创建一个update
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update); // 将update插入到updateQueue中 
  scheduleUpdateOnFiber(fiber, lane);  // 从当前触发更新的（也就是FC对应）fiber开始调度更新
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {  // 创建hook数据
    memoizedState: null,
    updateQueue: null,
    next: null,
    baseQueue: null,
    baseState: null,
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

function readContext<T>(context: ReactContext<T>): T {
  const consumer = currentlyRenderingFiber;
  if (consumer === null) {  // 代表了当前useContext脱离了函数组件来使用；eg：window.useContext(xxx)调用useContext
   throw new Error('只能在函数组件中调用useContext'); 
  }

  const value = context._currentValue;
  return value;
}