// 完整的工作循环
import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import { commitHookEffectListCreate, commitHookEffectListDestroy, commitHookEffectListUnmount, commitLayoutEffect, commitMutationEffect } from "./commitWorks";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, PendingPassiveEffects, createWorkInProgress } from "./fiber";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import { Lane, NoLane, SyncLane, getHighestPriority, getNextLane, lanesToSchedulerPriority, markRootFinished, markRootSuspended, mergeLanes } from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import { unstable_scheduleCallback as scheduleCallback, unstable_NormalPriority as NormalPriority, unstable_shouldYield, unstable_cancelCallback } from 'scheduler';
import { HookHasEffect, Passive } from "./hookEffectTag";
import { SuspenseException, getSuspenseThenable } from "./thenable";
import { resetHooksOnUnwind } from "./fiberHooks";
import { throwException } from "./fiberThrow";
import { unwindWork } from "./fiberUnwindWork";

// 定义一个全局变量存储fiberNode
let workInProgress : FiberNode | null = null;
let wipRootRenderLane : Lane = NoLane;  // 记录本次更新的lane是什么
let rootDoesHasPassiveEffects: boolean = false;

type RootExitStatus = number; // 当前root在render阶段退出时的状态

// 工作中的状态
const RootInProgress = 0;
// 并发更新的途中被打断
const RootInComplete: RootExitStatus = 1; // 中断执行（还没执行完）
// render完成
const RootCompleted: RootExitStatus = 2;  // 执行完了
// 由于挂起 当前是未完成的状态 不用进入commit阶段
const RootDidNotCompleted = 3;

// 退出状态
let wipRootExitStatus: number = RootInProgress;


type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0; // 未被挂起
const SuspendedOnData = 6;  // 由于请求数据被挂起

// 执行过程中 报错了
let wipSuspendedReason: SuspendedReason = NotSuspended; // 表示wip被挂起的原因，默认为未被挂起
let wipThrowValue: any = null;  // 保存抛出的数据

// 用于执行初始化操作
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;

  workInProgress = createWorkInProgress(root.current, {});  // fiberRootNode的current指向hostRootFiber
  wipRootRenderLane = lane;
  wipRootExitStatus = RootInProgress; // 表示进入工作中
  wipSuspendedReason = NotSuspended;
  wipThrowValue = null;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {  // 用于连接container和renderRoot方法（更新流程，即在fiber中调度update）
  // todo: 调度功能

  // 首屏渲染传入的是hostRootFiber；但是其他流程（例如this.setState）传入的是classComponent对应的fiber
  const root = markUpdateFromFiberToRoot(fiber); // 从当前的fiber一直向上遍历，得到fiberRootNode
  markRootUpdated(root, lane);  // 在schedule阶段记录lane
  ensureRootIsScheduled(root);
}

// schedule阶段入口
export function ensureRootIsScheduled(root: FiberRootNode) {
  // 在加入suspense功能之前可以这么写；但是加入了suspense之后，当前最高的优先级会存在被挂起的状态，现在应该获取pendingLanes中没有被挂起的那一部分中优先级最高的
  // const updateLane = getHighestPriority(root.pendingLanes); // 拿到当前root的lanes中优先级最高的lane
  const updateLane = getNextLane(root);
  const exitingCallbackNode = root.callbackNode;

  if (updateLane === NoLane) {  // root.pendingLanes中没有lane，没有lane对应的就是没有update，没有update对应的就是没有更新
    if (exitingCallbackNode !== null) {
      unstable_cancelCallback(exitingCallbackNode); // 取消调度
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane; // 当前执行的优先级
  const prevPriority = root.callbackPriority; // 上一次执行的优先级
  if (curPriority === prevPriority) { // 相同的话，代表是同优先级的更新（可能是时间切片被打断）
    return; // 不需要产生新的调度
  }

  // 出现了更高优先级的更新，那么需要把当前的更新取消掉，然后执行更高优先级的更新
  if (exitingCallbackNode !== null) {
    unstable_cancelCallback(exitingCallbackNode);
  }

  let newCallback = null;

  if (__DEV__) {
    console.log(`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级：`, updateLane);
  }

  if (updateLane === SyncLane) {
    // 同步优先级 用微任务调度
    // 在scheduleSyncCallback中构造了一个数组，每次触发更新，就会往这个数组中存入一个更新函数performSyncWorkOnRoot，即[performSyncWorkOnRoot, performSyncWorkOnRoot, ...]
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    // 最后按顺序执行这些存入的数组
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 用宏任务调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    // 调度器调度
    // @ts-ignore
    newCallback = scheduleCallback(schedulerPriority, performConcurrentWorkOnRoot.bind(null, root));
    // 为什么上面的同步调度不需要给newCallback赋值：因为同步调度不会有新的callbackNode
  }
  root.callbackNode = newCallback;  // 同步更新的话，callbackNode就是null
  root.callbackPriority = curPriority;
}

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function markUpdateFromFiberToRoot(fiber: FiberNode) { // 从当前的fiber一直遍历到根节点（fiberRootNode）
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {  // 找到根节点
    return node.stateNode;
  }
  return null;
}

// 并发更新的方法
function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean): any {  // didTimeout：是否过期
  const curCallback = root.callbackNode;
  // 在并发更新开始之前，要保证之前的useEffect都执行完了，
  // 原因：如果在一个函数组件中的useEffect里，调用了setXXX()方法触发更新，如果这个更新的优先级很高，高过了当前正在调度的优先级，那么当前的更新需要被打断，重新开始更高优先级的调度；
  // 也就是说useEffect的执行可能会触发更新，这个更新的优先级还需要跟当前正在调度的优先级进行比较
  const didFlushPassiveEffect = flushPassiveEffect(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallback) {  // 代表useEffect执行了，触发了更新；触发更新的优先级比当前正在调度的优先级还高
      return null;  // return null 表示不应该继续执行当前正在调度的优先级了
    }
  }

  // const lane = getHighestPriority(root.pendingLanes);
  const lane = getNextLane(root);

  const curCallbackNode = root.callbackNode;

  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeout; // 是否需要同步执行
  // render阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  // 退出状态
  switch (exitStatus) {
    case RootInComplete:  // 中断状态
      if (root.callbackNode !== curCallbackNode) {
        // 进入这里表示有更高优先级的更新插入进来了
        return null;
      }
      return performConcurrentWorkOnRoot.bind(null, root);  // 继续调度

    case RootCompleted: // 更新完成
      // 流程完毕后会重新回到根节点，那么就可以获取到新创建的wip fiberNode树
      // 因为这里的root是fiberRootNode，root.current字段指向hostRootFiber，那么root.current.alternate就是整个更新开始时执行的prepareFreshStack函数，创建的hostRootFiber对应的wip fiber；
      // 因为做完了整套操作，所以这是一棵完整的fiber树
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = lane; // 本次更新的lane
      wipRootRenderLane = NoLane;
      // 根据wip fiberNode树，以及树中的flags，执行具体的DOM操作
      commitRoot(root);
      break;

    case RootDidNotCompleted: // 没有完成
      wipRootRenderLane = NoLane;
      markRootSuspended(root, lane);  // 标记root被挂起了
      ensureRootIsScheduled(root);
      break;
    default:
      if (__DEV__) {
        console.error('还未实现并发更新结束状态');
      }
    break;
  }
}

// 同步调度的方法
function performSyncWorkOnRoot(root: FiberRootNode) { // 当前是同步更新的入口，后续还有并发更新的入口
  // const nextLane = getHighestPriority(root.pendingLanes);
  const nextLane = getNextLane(root);

  if (nextLane !== SyncLane) {  // 有两种情况： 1. 其他比syncLane低的优先级 2. NoLane
    // 不是同步更新
    ensureRootIsScheduled(root);  // 再次重新调度
    return;
  }

  const exitStatus = renderRoot(root, nextLane, false);

  switch (exitStatus) {
    case RootCompleted: // 完成的状态
      // 流程完毕后会重新回到根节点，那么就可以获取到新创建的wip fiberNode树
      // 因为这里的root是fiberRootNode，root.current字段指向hostRootFiber，那么root.current.alternate就是整个更新开始时执行的prepareFreshStack函数，创建的hostRootFiber对应的wip fiber；
      // 因为做完了整套操作，所以这是一棵完整的fiber树
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = nextLane; // 本次更新的lane
      wipRootRenderLane = NoLane;

      // 根据wip fiberNode树，以及树中的flags，执行具体的DOM操作
      commitRoot(root);
      break;

    case RootDidNotCompleted: // 没有完成
      wipRootRenderLane = NoLane;
      markRootSuspended(root, nextLane);  // 标记root被挂起了
      ensureRootIsScheduled(root);
      break;
  
    default:
      if (__DEV__) {
        console.error('还未实现同步更新结束状态');
      }
      break;
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {  // shouldTimeSlice：是否应该进行时间切片
  if (__DEV__) {
    console.warn(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
  }

  // wipRootRenderLane === lane时，可能是个中断再继续的过程
  if (wipRootRenderLane !== lane) {
    // 初始化
    // 也可能是：当前更新的是同步优先级，而wipRootRenderLane是一个DefaultLane优先级 之类的情况
    // 这里的root是fiberRootNode，root.current字段指向hostRootFiber
    prepareFreshStack(root, lane);
  }

  do {
    try {
      if (wipSuspendedReason !== NotSuspended && workInProgress !== null) {  // 表示当前已经挂起了 && wip不为空
        const thrownValue = wipThrowValue;
        wipSuspendedReason = NotSuspended;
        wipThrowValue = null;
        // 进入unwind流程
        throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane);
      }

      // 判断当前是否开启时间切片
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync(); // 开始递归
      // break的情况：1. 整个workLoop执行完了、2. 中断发生、3. 被catch了
      break;
    } catch(e) {
      if (__DEV__) {
        console.warn('workLoop发生错误', e);
      }
      // workInProgress = null; // unwind未实现之前的逻辑，直接将wip置空
      // 在这里可以捕获use hook抛出的错误
      handelThrow(root, e);
    }
  } while (true)

  // DidNotComplete情况
  if (wipRootExitStatus !== RootInProgress) { // 不在工作中
    return wipRootExitStatus;
  }

  // 执行到这，可能是：中断执行 ｜｜ render阶段执行完成
  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) { // 代表工作未执行完
    return RootInComplete;
  }
  // render阶段执行完
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error('render阶段结束时wip不应该不是null');
  }
  // TODO 报错
  return RootCompleted;
}

// 在workLoop执行的过程中报错了，需要执行的函数
function throwAndUnwindWorkLoop(root: FiberRootNode, unitOfWork: FiberNode, thrownValue: any, lane: Lane) { // unitOfWork: 当前挂起的节点 // thrownValue: 抛出的值
  // 1. 重置FC的全局变量（原因：因为当前要开启unwind流程，如果不重置的话，会造成在updateWorkInProgressHook执行时取到错误的hook，返回对应的hook数据是错误的；会报 本次执行时的Hook比上次执行时多 的错误）
  resetHooksOnUnwind();

  // 2. 在请求返回后重新触发更新 
  // 对于unwind流程需要重新触发更新，但是如果是 Error Boundary的情况，会做别的操作
  throwException(root, thrownValue, lane);

  // 3. unwind流程
  unwindUnitOfWork(unitOfWork);
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
  // unwind需要做的事：往上走
  let incompleteWork: FiberNode | null = unitOfWork; // 未完成的work
  do {
    // 往上走的目的：找到离当前最近的抛出异常的fiber 最近的suspense
    const next = unwindWork(incompleteWork);
    if (next !== null) {  // 找到了最近的suspense
      workInProgress = next;  // 当前workInProgress就是最近的suspense的fiber，接着就会以该suspense为起点，继续进行beginWork
      return;
    }

    // 没找到，继续往上找
    const returnFiber = incompleteWork.return as FiberNode;
    if (returnFiber !== null) {
      // 因为这是unwind流程，所以要把之前标记过的flags清除（因为这是回溯的过程，一会需要重新beginWork）
      returnFiber.deletions = null;
    }
    incompleteWork = returnFiber;
  } while (incompleteWork !== null);

  // 走到这了代表：使用了use，抛出了data，但是没有suspense包裹使用use hook对应的组件；那么就会一直往上找，找到了root
  wipRootExitStatus = RootDidNotCompleted;
  workInProgress = null;
}

// render过程中抛出的错误都是在该函数中处理
function handelThrow(root: FiberRootNode, thrownValue: any) {
  // 可以在这里处理Error Boundary的情况

  // 自定的错误类型
  if (thrownValue === SuspenseException) {  // suspense相关的错误
    thrownValue = getSuspenseThenable();  // 获取到抛出的错误
    wipSuspendedReason = SuspendedOnData;
  }
  wipThrowValue = thrownValue;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {  // 不存在commit阶段
    return;
  }

  if (__DEV__) {
    console.warn('commit阶段开始', finishedWork);
  }

  const lane = root.finishedLane;
  if (lane === NoLane &&  __DEV__) {
    console.error('commit阶段finishedLane不应该是NoLane');
  }

  // 重置操作
  root.finishedWork = null;
  root.finishedLane = NoLane;

  markRootFinished(root, lane); // 移除该lane

  if (
    (finishedWork.flags & PassiveMask) !== NoFlags || 
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) { // 代表当前fiber树中 存在函数组件需要执行useEffect的回调
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true; // 防止多次commitRoot时，执行调度副作用的操作
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行收集到的副作用
        flushPassiveEffect(root.pendingPassiveEffects);
        return;
      }); // 理解为：要调度一个异步的回调函数，也就是传入的第二个参数；这个回调函数会在一个setTimeout中被调度，调度的优先级是NormalPriority
    }
  }

  // 判断是否存在三个子阶段需要执行的操作
  // 需要判断root的flags和subtreeFlags
  const subtreeHasEffect = (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags; // 按位与
  const rootHasEffect = (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags; // 按位与
  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    
    // mutation（eg：Placement）
    commitMutationEffect(finishedWork, root);
    root.current = finishedWork;  // fiber树的切换（fiber树的切换时机发生在mutation执行完成和layout开始执行之前）

    // layout
    // 此时fiber树已经完成切换，wip fiber已经变成了current fiber
    commitLayoutEffect(finishedWork, root);
    
  } else {
    root.current = finishedWork;  // fiber树的切换（即使没有发生更新，也要执行切换操作）
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffect(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false;  // 判断当前是否有回调被执行
  // 整体流程：
  // 1. 首先触发所有unmount effect，且对于某个fiber，如果触发了unmount destroy，本次更新不会再触发update create
  pendingPassiveEffects.unmount.forEach(effect => { // 先执行unmount
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect); // 当前是useEffect的unmount执行（如果需要实现useLayoutEffect的话，可以直接把Passive改成Layout）
  });
  pendingPassiveEffects.unmount = []; 

  // 2. 触发所有上次更新的destroy
  // 本次更新的任何create回调都必须在所有上一次更新的destroy回调执行完后再执行。
  pendingPassiveEffects.update.forEach(effect => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect); // 对于所有effect来说，它不仅要是useEffect，必须是标记了HookHasEffect才能触发该函数
  });

  // 3. 触发所有这次更新的create
  pendingPassiveEffects.update.forEach(effect => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect); // 对于所有effect来说，它不仅要是useEffect，必须是标记了HookHasEffect才能触发该函数
  });
  pendingPassiveEffects.update = []; 

  // 对于在执行回调的过程中，还有可能会触发新的更新，那么就需要继续处理更新流程；eg：
  // const [num, updateNum] = useState(0);
  // useEffect(() => {
  //   console.log('App mount');
  //   updateNum(2)
  // }, []);

  // useEffect(() => {
  //   console.log('num change create', num);
  //   return () => {
  //     console.log('num change destroy', num);
  //   };
  // }, [num]);
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

// 不可中断的workLoop
function workLoopSync() {
  while(workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 能够被中断的workLoop
function workLoopConcurrent() {
  while(workInProgress !== null && !unstable_shouldYield()) { // shouldYield：是否应该被中断
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  // 开始做递操作
  const next = beginWork(fiber, wipRootRenderLane);  // next可能是当前fiber的子fiber，也可能是null
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {  // 不存在子fiber：即当前节点已经是最深层的节点（递的环节结束）
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;  // 继续向下递归
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;

  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return; // return指向父fiberNode
    workInProgress = node;
  } while (node !== null)
}
