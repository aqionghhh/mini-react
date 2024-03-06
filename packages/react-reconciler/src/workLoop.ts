// 完整的工作循环
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, createWorkInProgress } from "./fiber";
import { HostRoot } from "./workTags";

// 定义一个全局变量存储fiberNode
let workInProgress : FiberNode | null = null;

// 用于执行初始化操作
function prepareFreshStack(root: FiberRootNode) {
  workInProgress = createWorkInProgress(root.current, {});  // fiberRootNode的current指向hostRootFiber
}

export function scheduleUpdateOnFiber(fiber: FiberNode) {  // 用于连接container和renderRoot方法（更新流程，即在fiber中调度update）
  // todo: 调度功能

  // 首屏渲染传入的是hostRootFiber；但是其他流程（例如this.setState）传入的是classComponent对应的fiber
  const root = markUpdateFromFiberToRoot(fiber); // 从当前的fiber一直向上遍历，得到fiberRootNode
  renderRoot(root);
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

function renderRoot(root: FiberRootNode) {
  // 初始化
  prepareFreshStack(root);

  do {
    try {
      workLoop(); // 开始递归
      break;
    } catch(e) {
      console.warn('workLoop发生错误', e);
      workInProgress = null;
    }
  } while (true)
}

function workLoop() {
  while(workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  // 开始做递操作
  const next = beginWork(fiber);  // next可能是当前fiber的子fiber，也可能是null
  next.memoizedProps = fiber.pendingProps;

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
