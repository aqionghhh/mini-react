import { useState } from 'react';
import ReactDOM from 'react-dom';
const root = document.querySelector("#root");

// 点开performance面板，可以看到首屏渲染的时候（并发更新的render（时间切片））（首屏渲染师是normal的优先级，即DefaultLane） 和 点击事件触发的时候（不可中断的render）（点击事件是同步的优先级） 函数调用的情况

function App() {
  const [num, update] = useState(100);
  return (
    <ul onClick={() => update(50)}>
      {
        new Array(num).fill(0).map((_, i) => {
          return <Child key={i}>{i}</Child>
        })
      }
    </ul>
  );
}

function Child({children}) {
  const now = performance.now();
  while (performance.now() - now < 4) { }
  
  return <li>{children}</li>;
}
ReactDOM.createRoot(root).render(<App />);