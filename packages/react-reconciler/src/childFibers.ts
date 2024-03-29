import { Key, Props, ReactElementType } from "shared/ReactTypes";
import { FiberNode, createFiberFromElement, createFiberFromFragment, createWorkInProgress } from "./fiber";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import { Fragment, HostText } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";

type ExistingChildren = Map<string | number, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
  // 删除子节点
  function deleteChild (returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {  // 不需要追踪副作用
      return;
    }

    const deletions = returnFiber.deletions;  // deletions是父节点的宿主结构，这个结构保存了父节点下所有需要被删除的子节点
    if (deletions === null) { // 当前fiber下没有需要被删除的子fiber
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function deleteRemainingChildren(returnFiber: FiberNode, currentFirstChild: FiberNode | null) {
    if (!shouldTrackEffects) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {  // 遍历传入的child以及它的sibling
       deleteChild(returnFiber, childToDelete);
       childToDelete = childToDelete.sibling;
    }
  }

  // 单一节点
  function reconcileSingleElement(
    returnFiber: FiberNode, 
    currentFiber: FiberNode | null, 
    element: ReactElementType
  ) {  // 接收父亲fiber、当前的fiber、ReactElement
    const key = element.key;
    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) { //key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {  // 比较type之前需要判断一下element是不是一个ReactElement
          let props = element.props;
          if (props === REACT_FRAGMENT_TYPE) {
            props = element.props.children 
          }
          if (currentFiber.type === element.type) { // type 相同
            // key和type都相同，可以复用
            const existing = useFiber(currentFiber, props);
            existing.return = returnFiber;

            // 当前节点可复用，标记剩下的节点删除
            deleteRemainingChildren(returnFiber, currentFiber.sibling); // 既然当前节点可复用，那么就传入它的兄弟节点currentFiber，把剩余的兄弟节点都删掉

            return existing;
          }
          // key相同，type不同
          deleteRemainingChildren(returnFiber, currentFiber); // 删掉所有旧的
          break;
        } else {
          if (__DEV__) {
            console.warn('还未实现的react类型', element);
            break;
          }
        }
      } else {  // key不相同
        deleteChild(returnFiber, currentFiber); // 删掉旧的，继续遍历sibling
        currentFiber = currentFiber.sibling;
      }
    }

    // 创建新的
    // 根据element创建fiber并返回
    let fiber
    if (element.type === REACT_FRAGMENT_TYPE) {
      fiber = createFiberFromFragment(element.props.children, key);
    } else {
      fiber = createFiberFromElement(element);
    }
    fiber.return = returnFiber; // 将创建的fiber的父节点指向returnFiber
    return fiber;
  }

  // 单一节点
  function reconcileSingleTextNode(
    returnFiber: FiberNode, 
    currentFiber: FiberNode | null, 
    content: string | number
  ) {  // 接收父亲fiber、当前的fiber、ReactElement
    while (currentFiber !== null) {
      // update流程
      if (currentFiber.tag === HostText) {  // 节点的类型没有改变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling); // 既然当前节点可复用，那么就传入它的兄弟节点currentFiber，把剩余的兄弟节点都删掉
        return existing;
      } else {
        // eg: <div></div> 变成了 hahaha (原本的是hostComponent，变成了hostText)
        deleteChild(returnFiber, currentFiber); // 删掉旧的
        currentFiber = currentFiber.sibling;
      }
    }

    const fiber = new FiberNode(HostText, { content }, null); // 自定义一下当前fiber的结构：包含一个content字段，用于保存文本内容
    fiber.return = returnFiber;
    return fiber;
  }

  // 根据shouldTrackEffects判断是否应该标记副作用flags
  function placeSingleChild(fiber: FiberNode) {  // 是否插入单一的节点
    // 追踪副作用 && 首屏渲染
    if (shouldTrackEffects && fiber.alternate === null) { // fiber.alternate === null时代表首屏渲染的情况
      fiber.flags |= Placement; // 标记副作用
    }
    return fiber; // 不标记
  }

  function reconcileChildrenArray(returnFiber: FiberNode, currentFirstChild: FiberNode | null, newChild: any[]) {
    let lastPlaceIndex: number = 0; // 最后一个可复用fiber在current中的index
    let lastNewFiber: FiberNode | null = null; // 创建的最后一个fiber
    let firstNewFiber: FiberNode | null = null; // 创建的第一个fiber

    // 1. 将current保存在map中
    const existingChildren: ExistingChildren = new Map();
    // 注：当前current是更新前的FiberNode，是一条单向的链表；而newChild是一个数组，因为是由jsx转换来的，所以这个数组中存放的每一项都是ReactElement
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);  // 用当前current的key作为map的key，当前current作为map的value
      current = current.sibling;
    }

    // 2. 遍历newChild，寻找是否可复用
    for (let i = 0; i < newChild.length; i++) {
      const after = newChild[i];
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
      
      if (newFiber === null) {  // xxx => false;  xxx => null
        continue;
      }

      // 3. 标记移动还是插入（移动的具体是指 向右移动）
      // 移动的判断依据：element的index与「element对应current fiber」的index的比较
      // 如果可复用fiber的index < lastPlaceIndex，则标记Placement；否则 不标记
      newFiber.index = i;
      newFiber.return = returnFiber;

      if (lastNewFiber === null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      if (!shouldTrackEffects) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlaceIndex) {  // 标记移动
          newFiber.flags |= Placement;
          continue;
        } else {  // 不移动
          lastPlaceIndex = oldIndex;  // 更新lastPlaceIndex为新fiber对应的index
        }
      } else {
        // mount
        newFiber.flags |= Placement;  // 插入
      }
    }

    // 4. 将Map中剩下的标记为删除
    existingChildren.forEach(fiber => {
      deleteChild(returnFiber, fiber);
    });

    return firstNewFiber; // 返回第一个fiber
  }

  function getElementKeyToUse(element: any, index?: number): Key {
		if (
			Array.isArray(element) ||
			typeof element === 'string' ||
			typeof element === 'number' ||
			element === undefined ||
			element === null
		) {
			return index;
		}
		return element.key !== null ? element.key : index;
  }

  // 判断是否可复用（返回FiberNode的时候代表可复用，或是一个全新的fiber）
  function updateFromMap(returnFiber: FiberNode, existingChildren: ExistingChildren, index: number, element: any): FiberNode | null {
    const keyToUse = getElementKeyToUse(element, index);
    const before = existingChildren.get(keyToUse);  //如果取到了 就代表在更新之前存在对应的节点

    // 判断对应的节点是否能复用
    if (typeof element === 'string' || typeof element === 'number') { // element是HostText类型
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse);  // 可以复用的节点就从Map中删掉
          return useFiber(before, { content: element + '' }); // 复用before对应的fiber 创建当前的wip fiber
          // 为什么在这里不需要标记删除：因为判断完可复用节点后，所有的节点会统一 标记为删除，所以在这里不需要单独标记
        }
      }
      return new FiberNode(HostText, { content: element + '' }, null);  // 创建一个新的element
    }

    // element是ReactElement类型
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (element.type === REACT_FRAGMENT_TYPE) { // 数组中的某一项是Fragment类型
            return updateFragment(returnFiber, before, element, keyToUse, existingChildren);
          }
          if (before) {
            if (before.type === element.type) { // 走到这里代表key相同，type也相同
              existingChildren.delete(keyToUse);  // 可以复用的节点就从Map中删掉
              return useFiber(before, element.props); // 复用before对应的fiber 创建当前的wip fiber
            }
          }
          return createFiberFromElement(element);  // 创建一个新的element
      }
    }
    
    // element是数组或者Fragment的情况
    // eg：<ul>
    //       <li/>
    //       <li/>
    //       {[<li/>, <li/>]} // 这里的element是个数组类型
    //    </ul>
    if (Array.isArray(element) && __DEV__) {
      return updateFragment(returnFiber, before, element, keyToUse, existingChildren);
    }
    return null;
  }


  // 为什么要设计成闭包的形式：这样可以根据是否传shouldTrackEffects，返回不同的reconcileChildFibers的实现
  // 三个参数：父亲FiberNode、当前的子节点的current FiberNode，子节点的ReactElement
  return function reconcileChildFibers(
    returnFiber: FiberNode, 
    current: FiberNode | null, 
    newChild?: any
  ) {
    // 判断Fragment
    // Fragment包裹其他组件，即type为Fragment的ReactElement
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' && 
      newChild !== null && 
      newChild.type === REACT_FRAGMENT_TYPE && 
      newChild.key === null;  
      
    if (isUnkeyedTopLevelFragment) {  // 传入type类型为Fragment的ReactElement，那么newChild就重新赋值为newChild的children数组；变成数组后会进入下面的多节点情况
      newChild = newChild?.props.children;
    }

    // 判断当前fiber的类型
    if (typeof newChild === 'object' && newChild !== null) {
      // 多节点的情况：eg： ul > li * 3
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, current, newChild);
      }

      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:  // 代表当前newChild是一个ReactElement
          return placeSingleChild(reconcileSingleElement(returnFiber, current, newChild));
        default:
          if (__DEV__) {
            console.warn('未实现的reconcile类型', newChild);
          }
          break;
      }
    }
    
    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') { // 文本节点
      return placeSingleChild(reconcileSingleTextNode(returnFiber, current, newChild));
    }

    // 加一个兜底情况
    if (current !== null) {
      deleteRemainingChildren(returnFiber, current);
    }

    if (__DEV__) {
      console.warn('未实现的reconcile类型', newChild);
    }
    return null;
  }
}

// 处理服用fiber的情况
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode { // 传入的fiber就是需要复用的fiber
  const clone = createWorkInProgress(fiber, pendingProps);  // 这个复用的过程对于同一个fiber来说，会重复使用这两个fiberNode：current、wip，而不会去创建新的fiberNode
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

function updateFragment(
  returnFiber: FiberNode, 
  current: FiberNode | undefined, 
  elements: any[], 
  key: Key, 
  existingChildren: ExistingChildren
) {
  let fiber;
  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key);
  } else {  // current存在，且更新前后都是Fragment
    // 复用
    existingChildren.delete(key);
    fiber = useFiber(current, elements);
  }
  fiber.return = returnFiber;
  return fiber;
}

export const reconcileChildFibers = ChildReconciler(true);  // 追踪副作用
export const mountChildFibers = ChildReconciler(false);  // 不追踪副作用
