import { Props, ReactElementType } from "shared/ReactTypes";
import { FiberNode, createFiberFromElement, createWorkInProgress } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";


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

  function reconcileSingleElement(
    returnFiber: FiberNode, 
    currentFiber: FiberNode | null, 
    element: ReactElementType
  ) {  // 接收父亲fiber、当前的fiber、ReactElement
    const key = element.key;
    work: if (currentFiber !== null ) {
      // update
      if (currentFiber.key === key) { //key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {  // 比较type之前需要判断一下element是不是一个ReactElement
          if (currentFiber.type === element.type) { // type 相同
            // key和type都相同，可以复用
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }
          // key相同，type不同
          deleteChild(returnFiber, currentFiber); // 删掉旧的
          break work;
        } else {
          if (__DEV__) {
            console.warn('还未实现的react类型', element);
            break work;
          }
        }
      } else {  // key不相同
        deleteChild(returnFiber, currentFiber); // 删掉旧的
        break work;
      }
    }

    // 创建新的
    // 根据element创建fiber并返回
    const fiber = createFiberFromElement(element);
    fiber.return = returnFiber; // 将创建的fiber的父节点指向returnFiber
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode, 
    currentFiber: FiberNode | null, 
    content: string | number
  ) {  // 接收父亲fiber、当前的fiber、ReactElement
    if (currentFiber !== null) {
      // update流程
      if (currentFiber.tag === HostText) {  // 节点的类型没有改变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      } else {
        // eg: <div></div> 变成了 hahaha (原本的是hostComponent，变成了hostText)
        deleteChild(returnFiber, currentFiber); // 删掉旧的
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

  // 为什么要设计成闭包的形式：这样可以根据是否传shouldTrackEffects，返回不同的reconcileChildFibers的实现
  // 三个参数：父亲FiberNode、当前的子节点的current FiberNode，子节点的ReactElement
  return function reconcileChildFibers(
    returnFiber: FiberNode, 
    current: FiberNode | null, 
    newChild?: ReactElementType
  ) {
    // 判断当前fiber的类型
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:  // 代表当前newChild是一个ReactElement
          return placeSingleChild(reconcileSingleElement(returnFiber, current, newChild));
        default:
          if (__DEV__) {
            console.warn('未实现的reconsile类型', newChild);
          }
          break;
      }
    }
    // TODO 多节点的情况：eg： ul > li * 3
    
    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') { // 文本节点
      return placeSingleChild(reconcileSingleTextNode(returnFiber, current, newChild));
    }

    // 加一个兜底情况
    if (current !== null) {
      deleteChild(returnFiber, current);
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

export const reconcileChildFibers = ChildReconciler(true);  // 追踪副作用
export const mountChildFibers = ChildReconciler(false);  // 不追踪副作用
