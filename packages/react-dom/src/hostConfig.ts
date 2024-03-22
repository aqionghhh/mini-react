import { FiberNode } from "react-reconciler/src/fiber";
import { HostComponent, HostText } from "react-reconciler/src/workTags";
import { DOMElement, updateFiberProps } from './SyntheticEvent'

// 描述宿主环境方法的文件
export type Container = Element;  // 对于react-dom来说，Container的类型是Element
export type Instance = Element;
export type TextInstance = Text;

// createInstance方法
export const createInstance = (type: string, props: any): Instance => {
  //TODO: 处理props

  const element = document.createElement(type) as unknown; // 创建一个节点
  updateFiberProps(element as DOMElement, props); // 在创建DOM时，将事件回调保存在DOM上
  return element as DOMElement ;
}

// 插入子节点
export const appendInitialChild = (parent: Instance | Container, child: Instance) => {
  parent.appendChild(child);
}

// 创建文本节点
export const createTextInstance= (content: string) => {
  return document.createTextNode(content);
}

// 将宿主环境的节点插入到hostParent中
export const appendChildToContainer = appendInitialChild;


export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;
      commitTextUpdate(fiber.stateNode, text);
      break;
    case HostComponent:

      break;
  
    default:
      if (__DEV__) {
        console.warn('未实现的update类型', fiber);
      }
      break;
  }
}

export function commitTextUpdate(textInstance: TextInstance, content: string) { // 接收文本实例，以及要改变的内容
  textInstance.textContent = content;
}

export function removeChild(child: Instance | TextInstance, container: Container) {
  container.removeChild(child);
}

export function insertChildToContainer(child: Instance, container: Container, before: Instance) {
  container.insertBefore(child, before);
}

// 通过什么样的方式执行微任务和宏任务，是通过宿主环境决定的，所以写在react-dom中
// 这里采用的也是优雅降级 queueMicrotask -> Promise -> setTimeout
export const scheduleMicroTask = 
  typeof queueMicrotask === 'function' 
    ? queueMicrotask 
    : typeof Promise === 'function' 
    ? (callback: (...arg: any) => void) => Promise.resolve(null).then(callback) 
    : setTimeout;