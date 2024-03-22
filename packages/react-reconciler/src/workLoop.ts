// 完整的工作循环
import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import { commitMutationEffect } from "./commitWorks";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, createWorkInProgress } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { Lane, NoLane, SyncLane, getHighestPriority, markRootFinished, mergeLanes } from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";

// 定义一个全局变量存储fiberNode
let workInProgress : FiberNode | null = null;
let wipRootRenderLane : Lane = NoLane;  // 记录本次更新的lane是什么

// 用于执行初始化操作
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {});  // fiberRootNode的current指向hostRootFiber
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {  // 用于连接container和renderRoot方法（更新流程，即在fiber中调度update）
  // todo: 调度功能

  // 首屏渲染传入的是hostRootFiber；但是其他流程（例如this.setState）传入的是classComponent对应的fiber
  const root = markUpdateFromFiberToRoot(fiber); // 从当前的fiber一直向上遍历，得到fiberRootNode
  markRootUpdated(root, lane);  // 在schedule阶段记录lane
  ensureRootIsScheduled(root);
}

// schedule阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriority(root.pendingLanes); // 拿到当前root的lanes中优先级最高的lane
  if (updateLane === NoLane) {  // root.pendingLanes中没有lane，没有lane对应的就是没有update，没有update对应的就是没有更新
    return;
  }

  if (updateLane === SyncLane) {
    // 同步优先级 用微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级：', updateLane);
    }
    // 在scheduleSyncCallback中构造了一个数组，每次触发更新，就会往这个数组中存入一个更新函数performSyncWorkOnRoot，即[performSyncWorkOnRoot, performSyncWorkOnRoot, ...]
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    // 最后按顺序执行这些存入的数组
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 用宏任务调度

  }
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
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

// function renderRoot(root: FiberRootNode) { // 原本是renderRoot，加了lane调度之后改名改实现方式了
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) { // 当前是同步更新的入口，后续还有并发更新的入口
  const nextLane = getHighestPriority(root.pendingLanes);
  if (nextLane !== SyncLane) {  // 有两种情况： 1. 其他比syncLane低的优先级 2. NoLane
    // 不是同步更新
    ensureRootIsScheduled(root);  // 再次重新调度
    return;
  }

  if (__DEV__) {
    console.warn('render阶段开始');
  }

  // 初始化
  // 这里的root是fiberRootNode，root.current字段指向hostRootFiber
  prepareFreshStack(root, lane);

  do {
    try {
      workLoop(); // 开始递归
      break;
    } catch(e) {
      if (__DEV__) {
        console.warn('workLoop发生错误', e);
      }
      workInProgress = null;
    }
  } while (true)
  
  // 流程完毕后会重新回到根节点，那么就可以获取到新创建的wip fiberNode树
  // 因为这里的root是fiberRootNode，root.current字段指向hostRootFiber，那么root.current.alternate就是整个更新开始时执行的prepareFreshStack函数，创建的hostRootFiber对应的wip fiber；
  // 因为做完了整套操作，所以这是一棵完整的fiber树
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane; // 本次更新的lane
  wipRootRenderLane = NoLane;

  // 根据wip fiberNode树，以及树中的flags，执行具体的DOM操作
  commitRoot(root);
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

  // 判断是否存在三个子阶段需要执行的操作
  // 需要判断root的flags和subtreeFlags
  const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags // 按位与
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags // 按位与
  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    
    // mutation（eg：Placement）
    commitMutationEffect(finishedWork);
    root.current = finishedWork;  // fiber树的切换（fiber树的切换时机发生在mutation执行完成和layout开始执行之前）

    // layout
    
  } else {
    root.current = finishedWork;  // fiber树的切换（即使没有发生更新，也要执行切换操作）
  }
}

function workLoop() {
  while(workInProgress !== null) {
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
