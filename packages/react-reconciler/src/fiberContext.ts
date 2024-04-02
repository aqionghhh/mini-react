import { ReactContext } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { Lane, NoLanes, includeSomeLanes, isSubsetOfLanes, mergeLanes } from "./fiberLanes";
import { markWipReceivedUpdate } from "./beginWork";
import { ContextProvider } from "./workTags";

let lastContextDep: ContextItem<any> | null = null; // 保存依赖链表的最后一项

export interface ContextItem<Value> {
  context: ReactContext<Value>;
  memoizedState: Value;
  next: ContextItem<Value> | null;  // 指向下一个ContextItem
}

// const ctx = createContext(0);

// <ctx.Provider value={1}>
//   <Cpn />
// </ctx.Provider>
//   <Cpn />
// 对于上述例子，在第一个<Cpn />中获取到的值是1，而第二个<Cpn />得到的值是0
// 所以在ctx.Provider的beginWork时，修改ctx的值；在ctx.Provider的completeWork时将值还原成原来的旧值

let prevContextValue: any = null;  // 上一个contextValue
const prevContextValueStack: any[] = [];  // 因为会出现context嵌套的情况，所以需要一个栈来保存contextValue的旧值

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue);

  prevContextValue = context._currentValue;
  context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
  context._currentValue = prevContextValue;
  
  prevContextValue = prevContextValueStack.pop();
}

// 执行readContext之前重置lastContextDep
export function prepareToReadContext(wip: FiberNode, renderLane: Lane) {
  lastContextDep = null; 

  const deps = wip.dependencies;
  if (deps !== null) {
    const firstContext = deps.firstContext;
    if (firstContext) { // 存在context
      if (includeSomeLanes(deps.lanes, renderLane)) { // deps.lanes：这些context对应的更新的lane
        // renderLane包含在deps.lanes中
        // 代表本次更新的renderLane会改变其中某一个context的值
        markWipReceivedUpdate();  // 标记没有命中bailout策略
      }
      deps.firstContext = null;
    }
  }
}

export function readContext<T>(consumer: FiberNode | null, context: ReactContext<T>): T {
  if (consumer === null) {  // 代表了当前useContext脱离了函数组件来使用；eg：window.useContext(xxx)调用useContext
   throw new Error('只能在函数组件中调用useContext'); 
  }

  const value = context._currentValue;

  // 建立fiber和context的依赖关系
  const contextItem: ContextItem<T> = {
    context,
    next: null,
    memoizedState: value, 
  }

  if (lastContextDep === null) {  // 表示当前函数render时遇到的第一个context
    lastContextDep = contextItem;
    consumer.dependencies = {
      firstContext: contextItem,
      lanes: NoLanes
    };
  } else {
    lastContextDep = lastContextDep.next = contextItem; // 指针后移
  }

  return value;
}

// 向下寻找（不是beginWork本身的深度优先遍历）
export function propagateContextChange<T>(wip: FiberNode, context: ReactContext<T>, renderLane: Lane) {  // wip对应了value值发生改变的context
  let fiber = wip.child;
  if (fiber !== null) {
    // 保持连接
    fiber.return = wip;
  }

  while (fiber !== null) {
    let nextFiber = null;
    const deps = fiber.dependencies;
    if (deps !== null) {  // 当前是个函数组件，并且这个函数组件依赖了某些context，但不确定依赖的context是不是当前的目标context
      nextFiber = fiber.child;

      let contextItem = deps.firstContext;
      while (contextItem !== null) { // 遍历firstContext这条链表
        if (contextItem.context === context) {  // 找到了依赖当前context的函数组件
          fiber.lanes = mergeLanes(fiber.lanes, renderLane);
          const alternate = fiber.alternate;
          if (alternate !== null) {
            alternate.lanes = mergeLanes(alternate.lanes, renderLane);
          }

          // 往上遍历 标记沿途的fiber.childLanes
          scheduleContextWorkOnParentPath(fiber.return, wip, renderLane);

          deps.lanes = mergeLanes(deps.lanes, renderLane);
          break;
        } else {
          // 没找到 继续逼阿里下一个
          contextItem = contextItem.next;
        }
      }

    } else if (fiber.tag === ContextProvider) { // 遇到了context嵌套的情况
      // 判断嵌套的这个context是否跟当前的context一致（是否是同一个context）
      // 如果是的话，就没必要继续往下遍历了，因为被嵌套的context也会开启一个向下寻找的过程
      // 否则继续向下
      nextFiber = fiber.type === wip.type ? null : fiber.child;
    } else {
      nextFiber = fiber.child;
    }

    if (nextFiber !== null) { // 保持连接
      nextFiber.return = fiber;
    } else {  // 到了叶子节点
      nextFiber = fiber;
      while (nextFiber !== null) {
        if (nextFiber === wip) {  // 终止条件
          nextFiber = null;
          break;
        }
        const sibling = nextFiber.sibling;
        if (sibling !== null) {
          sibling.return = nextFiber.return;
          nextFiber = sibling;
          break;
        }
        nextFiber = nextFiber.return; // sibling找完后，往上找一级
      }
    }
    fiber = nextFiber;
  }
}

// 在当前contextItem到其父级context的路径上，把renderLane标记在沿途的fiber.childLanes上
function scheduleContextWorkOnParentPath(from: FiberNode | null,to: FiberNode, renderLane: Lane) {
  let node = from;

  while (node !== null) { // 往上
    const alternate = node.alternate;

    if (!isSubsetOfLanes(node.childLanes, renderLane)) { // 不包含的话
      node.childLanes = mergeLanes(node.childLanes, renderLane);  // 附加上
      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLane);  // 附加上
      }
    } else if (alternate !== null && !isSubsetOfLanes(alternate.childLanes, renderLane)) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLane);  // 附加上
    }

    // 终止条件
    if (node === to) {
      break;
    }
    node = node.return;
  }
}