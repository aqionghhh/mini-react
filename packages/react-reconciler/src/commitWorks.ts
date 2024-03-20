import { Container, Instance, appendChildToContainer, commitUpdate, insertChildToContainer, removeChild } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { ChildDeletion, MutationMask, NoFlags, Placement, Update } from "./fiberFlags";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";

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
  if ((flags & Update) !== NoFlags) {  // 存在Update操作
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update; // 将Update从当前fiber节点中移除
  }

  // flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {  // 存在ChildDeletion操作
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach(childToDelete => {
        commitDeletion(childToDelete)
      })
    }
    finishedWork.flags &= ~ChildDeletion; // 将ChildDeletion从当前fiber节点中移除
  }
}

function commitDeletion(childToDelete: FiberNode) {
  // 注：当前删除的child可能会包含子树
  // eg: <div><App />123<div><Child /></div></div>
  // 当要删除外部的div时，要把div的内部元素一起删掉，但是里面包含不同类型的组件；对于不同类型的组件在被删除的情况下，需要做不同的处理
  // 子树会出现这些情况：如果是FC，需要做unmount、解绑ref的处理；如果是HostComponent，需要解绑ref；对于子树的根HostComponent，需要移除DOM（这里的eg中，根HostComponent是外部的div）
  // 所以在这个函数中需要做递归操作
  let rootHostNode: FiberNode | null = null;  // rootHostNode就是这棵子树的根HostComponent

  // 递归子树
  commitNestedComponent(childToDelete, unmountFiber => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber;
        }
        // TODO 解绑ref
        return;

      case HostText:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber;
        }
        return;

      case FunctionComponent:
        // TODO useEffect unmount
        return;

      default:
        if (__DEV__) {
          console.warn('未处理的unmount类型', unmountFiber);
        }
        break;
    }
  });

  // 移除rootHostNode
  if (rootHostNode !== null) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      removeChild((rootHostNode as FiberNode).stateNode, hostParent);
    }
  }

  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent( // 深度优先遍历
  root: FiberNode, // 子树的根节点
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    if (node.child !== null) {
      // 向下遍历的过程 
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === root) {  // 终止条件
      return;      
    }
    
    // 处理兄弟节点
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      // 向上归
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork);
  }
  
  // 需要知道父级的DOM节点
  const hostParent = getHostParent(finishedWork);

  // 寻找到目标兄弟Host节点 执行插入操作（insertBefore）
  // 注：要考虑两个因素：可能不是目标fiber的直接兄弟节点；不稳定的Host节点不能作为「目标兄弟Host节点」
  const sibling = getHostSibling(finishedWork);

  // 需要知道当前finishedWork对应的DOM节点
  if (hostParent !== null) {
    insertOrAppendPlaceNodeIntoContainer(finishedWork, hostParent, sibling);
  }
}

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;

  findSibling: while (true) {
    while (node.sibling === null) { // 向上查找
      const parent = node.return;

      if (parent === null || parent.tag === HostComponent || parent.tag === HostRoot) { // 没找到
        return null;
      }
      node = parent;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostText && node.tag !== HostComponent) { // 直接sibling不是host类型
      // 向下遍历，寻找子孙节点
      if ((node.flags & Placement) !== NoFlags) { // 代表这个节点是不稳定的，需要继续findSibling
        continue findSibling;
      }
      if (node.child === null) {  // 找到底了
        continue findSibling;
      } else {  // 向下遍历
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {  // host类型
      return node.stateNode;
    }
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
function insertOrAppendPlaceNodeIntoContainer(finishedWork: FiberNode, hostParent: Container, before?: Instance) {
  // 传入的finishedWork不一定是host类型的fiber节点，所以需要向下遍历；通过传入的fiber，找到对应的宿主环境（host类型）的fiber，然后append到hostParent下
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before); // 在stateNode之前插入节点
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);  // 在container的末尾插入节点
    }
    return;
  }
  // 向下遍历（递归）
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlaceNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlaceNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}