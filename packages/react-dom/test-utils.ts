// 用于测试的工具集

import { ReactElementType } from "shared/ReactTypes";
// @ts-ignore
import { createRoot } from "react-dom"; // 不直接从./src/root中引入，而是从react-dom中引入
// 因为最终在测试用例里面，引入的肯定是类似React、ReactDOM，对于testUtils来说，React、ReactDOM都是它外部的依赖，既然是外部依赖，那么引入的这个代码就不应该被打包进testUtils这个包里面

export function renderIntoDocument(element: ReactElementType) {
  const div = document.createElement('div');

  // 因为没有实现ReactDOM.render方法，所以直接使用ReactDOM.createRoot
  return createRoot(div).render(element); // 返回一个element
}; 
