// 完整的工作循环
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { FiberNode } from "./fiber";

// 定义一个全局变量存储fiberNode
let workInProgress : FiberNode | null = null;

// 用于执行初始化操作
function prepareFreshStack(fiber: FiberNode) {
  workInProgress = fiber;
}

function renderRoot(root: FiberNode) {
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
