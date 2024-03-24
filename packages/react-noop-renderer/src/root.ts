// 对于ReactDOM来说的话，通常要实现的是：
// ReactDOM.createRoot(root).render(<APP/>);
// 执行ReactDOM.createRoot(root)，会返回一个对象，这个对象中包含render方法，这个render方法接收一个element（ReactElementType）

import { Container, Instance } from "./hostConfig"
import { createContainer, updateContainer } from "react-reconciler/src/fiberReconciler"
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import { ReactElementType } from "shared/ReactTypes";
import * as Scheduler from "scheduler";

let idCounter = 0;

export function createRoot() {
  // 创建container
  const container: Container = {
    rootID: idCounter++,
    children: []
  }

  // @ts-ignore
  const root = createContainer(container);

  // 辅助方法
  function getChildren(parent: Container | Instance) {
    if (parent) {
      return parent.children;
    }
    return null;
  }

  // 以ReactElement的形式导出树状结构
  function getChildrenAsJSX(child: any): any {
    const children = childToJSX(getChildren(child));
    if (Array.isArray(children)) {
      // 构造成Fragment
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: REACT_FRAGMENT_TYPE,
        key: null,
        ref: null,
        props: { children },
        __mark: 'sxq'
      }
    }

    return children;
  }

  // child转成jsx形式
  function childToJSX(child: any): any {
    if (typeof child === 'string' || typeof child === 'number') { // 对应的是文本节点
      return child;
    }

    // 数组情况
    if (Array.isArray(child)) {
      if (child.length === 0) {
        return null;
      }
      if (child.length === 1) {
        return childToJSX(child[0]);
      }
      const children = child.map(childToJSX);

      // children中的每一项都是string或number
      if (children.every(child => typeof child === 'string' || typeof child === 'number')) {
        return child.join('');
      } 
      // 包含了一些Instance
      return children;
    }

    // Instance情况
    if (Array.isArray(child.children)) {
      const instance: Instance = child;
      const children = childToJSX(instance.children);
      const props = instance.props;

      if (children !== null) {
        props.children = children;
      }
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: instance.type,
        key: null,
        ref: null,
        props,
        __mark: 'sxq'
      };
    }

    // TextInstance情况 [TextInstance, TextInstance, Instance]
    return child.text;
  }

  return {
    _Scheduler: Scheduler,  // matcher需要
    render(element: ReactElementType) {
      return updateContainer(element, root);
    },
    getChildren() { // 辅助方法，获取container的children
      return getChildren(container);
    },
    getChildrenAsJSX() {
      return getChildrenAsJSX(container);
    }
  }
}