import { ReactElementType } from "shared/ReactTypes";
import { FiberNode, createFiberFromElement } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./workTags";
import { Placement } from "./fiberFlags";


function ChildReconciler(shouldTrackEffects: boolean) {
  function reconcileSingleElement(
    returnFiber: FiberNode, 
    currentFiber: FiberNode | null, 
    element: ReactElementType
  ) {  // 接收父亲fiber、当前的fiber、ReactElement
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

    if (__DEV__) {
      console.warn('未实现的reconsile类型', newChild);
    }
    return null;
  }
}

export const reconcileChildFibers = ChildReconciler(true);  // 追踪副作用
export const mountChildFibers = ChildReconciler(false);  // 不追踪副作用
