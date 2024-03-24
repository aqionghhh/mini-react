import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";
import { Props } from "shared/ReactTypes";

// 描述宿主环境方法的文件
export interface Container {
  rootID: number;
  children: (Instance | TextInstance)[];
};
export interface Instance {
  id: number;
  type: string;
  children: (Instance | TextInstance)[];
  parent: number; // 父节点id
  props: Props;
};
export interface TextInstance {
  text: string;
  id: number;
  parent: number; // 父节点id
};

let instanceCounter = 0;

// createInstance方法
export const createInstance = (type: string, props: any): Instance => {
  const instance = {
    id: instanceCounter++,
    type,
    children: [],
    parent: -1,
    props
  };

  return instance;
}

// 插入子节点
export const appendInitialChild = (parent: Instance | Container, child: Instance) => {
  // child.parent指向的是父级的id
  const prevParentID = child.parent;
  const parentID = 'rootID' in parent ? parent.rootID : parent.id;  // 'rootID' in parent为true时 代表parent是Container，否则是Instance
  
  if (prevParentID !== -1 && // 表示child已经有parent了（已经被插入过）
    prevParentID !== parentID // 两个同时为true，表示要进行重复插入的操作
  ) {
    throw new Error('不能重复挂载child');
  }
  child.parent = parentID;
  parent.children.push(child);  // 插入操作
}

// 创建文本节点
export const createTextInstance= (content: string) => {
  const textInstance = {
    text: content,
    id: instanceCounter++,
    parent: -1
  };
  return textInstance;
}

// 将宿主环境的节点插入到hostParent中
export const appendChildToContainer = (parent: Container, child: Instance) => {
    // child.parent指向的是父级的id
    const prevParentID = child.parent;
    
    if (prevParentID !== -1 && // 表示child已经有parent了（已经被插入过）
      prevParentID !== parent.rootID // 两个同时为true，表示要进行重复插入的操作
    ) {
      throw new Error('不能重复挂载child');
    }
    child.parent = parent.rootID;
    parent.children.push(child);  // 插入操作 
}


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
  textInstance.text = content;
}

export function removeChild(child: Instance | TextInstance, container: Container) {
  const index = container.children.indexOf(child);

  if (index === -1) {
    throw new Error('child不存在');
  }
  container.children.splice(index, 1);  // 移除child
}

// 插入操作
export function insertChildToContainer(child: Instance, container: Container, before: Instance) {
  const beforeIndex = container.children.indexOf(before);

  if (beforeIndex === -1) {
    throw new Error('before不存在');
  }
  const index = container.children.indexOf(child);
  if (index !== -1) { // child已经被插入了，但是现在需要把child插入到before之前
    container.children.splice(index, 1);  // 先移除child
  }
  container.children.splice(beforeIndex, 0, child);  // 插入child
}

// 通过什么样的方式执行微任务和宏任务，是通过宿主环境决定的，react-noop-renderer的实现跟react-dom一致
// 这里采用的也是优雅降级 queueMicrotask -> Promise -> setTimeout
export const scheduleMicroTask = 
  typeof queueMicrotask === 'function' 
    ? queueMicrotask 
    : typeof Promise === 'function' 
    ? (callback: (...arg: any) => void) => Promise.resolve(null).then(callback) 
    : setTimeout;