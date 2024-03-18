import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";

// 描述宿主环境方法的文件
export type Container = Element;  // 对于react-dom来说，Container的类型是Element
export type Instance = Element;
export type TextInstance = Text;

// createInstance方法
export const createInstance = (type: string, props: any): Instance => {
  //TODO: 处理props

  const element = document.createElement(type); // 创建一个节点
  return element;
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
