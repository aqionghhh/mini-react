// 描述宿主环境方法的文件
export type Container = Element;  // 对于react-dom来说，Container的类型是Element
export type Instance = Element;

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
