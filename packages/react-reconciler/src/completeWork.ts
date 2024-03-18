// 递归中的归阶段

import { Container, appendInitialChild, createInstance, createTextInstance } from "hostConfig";
import { FiberNode } from "./fiber";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { NoFlags, Update } from "./fiberFlags";

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) { // update阶段
        
      } else {  // mount阶段
        // 构建离屏DOM树
        // 1. 构建DOM
        const instance = createInstance(wip.type, newProps);  // 创建出宿主环境的实例，对应浏览器环境来说就是一个DOM节点
        // 2. 将DOM插入到DOM树中
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
    return null;
    case HostText:
      if (current !== null && wip.stateNode) { // update阶段
        const oldText = current.memoizedProps.content;
        const newText = newProps.content;

        if (oldText !== newText) {  // 标记更新
          markUpdate(wip);
        }
      } else {  // mount阶段
        // 构建离屏DOM树
        // 1. 构建DOM（创建一个文本节点）
        const instance = createTextInstance(newProps.content); // newProps.content可能是number或者string类型
        // 2. 将DOM插入到DOM树中（因为不存在子节点和兄弟节点，所以不需要执行appendAllChildren操作)
        wip.stateNode = instance; 
      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
      bubbleProperties(wip);
      return null;
    case FunctionComponent:
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn('未处理的completeWork情况', wip);
      }
      break;
  }
}

// 在parent下插入wip这个节点
// wip有可能不是一个DOM节点，所以需要对wip做一个递归的流程，寻找它里面的HostComponent和HostText类型的节点
function appendAllChildren(parent: Container, wip: FiberNode) {
  let node = wip.child;

  // 先往下找，找到后执行appendChild的操作，如果没找到就继续往下找 
  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) { // 最简单的情况，直接执行插入的方法
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) { // 继续往下遍历
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    // 兄弟节点
    while (node.sibling === null) {
      // 走到这里代表已经无子节点以及兄弟节点，应该做归（向上）操作
      if (node.return === null || node.return === wip) {  // 已经回到原点
        return;
      }
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling; 
  }
}

// 利用completeWork向上遍历（归）的流程，将子fiberNode的flags冒泡到父fiberNode
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags; // subtreeFlags字段会包含当前节点的子节点的flags以及子节点的subtreeFlags
  let child = wip.child;

  while (child !== null) {
    subtreeFlags |= child.subtreeFlags; // 用位运算的按位或的方式，将当前节点的子节点subtreeFlags附加起来
    subtreeFlags |= child.flags;

    // 遍历child以及它的sibling
    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}