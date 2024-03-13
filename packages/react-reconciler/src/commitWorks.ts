import { Container, appendChildToContainer } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";

// nextEffect指向下一个需要执行的effect
let nextEffect: FiberNode | null = null;

export const commitMutationEffect = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) { // 向下遍历
    const child: FiberNode | null = nextEffect.child;

    // subtreeFlags包含了MutationMask中需要执行的操作，并且child不为空
    if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
      nextEffect = child;
    } else {
      // 要么已经找到底了，要么就是不包含MutationMask中需要执行的操作；但是可能包含flags
      up: while (nextEffect !== null) {
        commitMutationEffectOnFiber(nextEffect);
        const sibling: FiberNode | null = nextEffect.sibling;

        if (sibling !== null) { // 继续遍历sibling
          nextEffect = sibling;
          break up;
        }
        // 向上遍历
        nextEffect = nextEffect.return;
      }
    }
  }
}

const commitMutationEffectOnFiber = (finishedWork: FiberNode) => {  // 当前的finishedWork就是真正存在flags的fiber节点  
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {  // 存在Placement操作
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement; // 将Placement从当前fiber节点中移除
  }

  // flags Update
  // flags ChildDeletion
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork);
  }
  
  // 需要知道父级的DOM节点
  const hostParent = getHostParent(finishedWork);
  // 需要知道当前finishedWork对应的DOM节点
  if (hostParent !== null) {
    appendPlaceNodeIntoContainer(finishedWork, hostParent);
  }
}

function getHostParent(fiber: FiberNode): Container | null {
  // 执行向上遍历的过程
  let parent = fiber.return;
  while (parent) {
    const parentTag = parent.tag;
    // hostComponent HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode;  // 对应HostComponent类型的fiber节点来说，它对应的宿主环境节点保存在fiber.stateNode中
    }
    if (parentTag === HostRoot) {  // hostRootFiber的stateNode指向fiberRootNode，fiberRootNode的container字段指向它对应的宿主环境节点
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn('未找到host parent');
  }

  return null;
}

// 将新增的节点插入到container
function appendPlaceNodeIntoContainer(finishedWork: FiberNode, hostParent: Container) {
  // 传入的finishedWork不一定是host类型的fiber节点，所以需要向下遍历；通过传入的fiber，找到对应的宿主环境（host类型）的fiber，然后append到hostParent下
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(finishedWork.stateNode, hostParent);  
    return;
  }
  // 向下遍历（递归）
  const child = finishedWork.child;
  if (child !== null) {
    appendPlaceNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      appendPlaceNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}