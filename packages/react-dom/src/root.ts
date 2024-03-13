// 对于ReactDOM来说的话，通常要实现的是：
// ReactDOM.createRoot(root).render(<APP/>);
// 执行ReactDOM.createRoot(root)，会返回一个对象，这个对象中包含render方法，这个render方法接收一个element（ReactElementType）

import { Container } from "hostConfig"
import { createContainer, updateContainer } from "react-reconciler/src/fiberReconciler"
import { ReactElementType } from "shared/ReactTypes";

export function createRoot(container: Container) {
  const root = createContainer(container);

  return {
    render(element: ReactElementType) {
      updateContainer(element, root);
    }
  }
}