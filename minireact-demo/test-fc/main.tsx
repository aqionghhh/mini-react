import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);

  // 当嵌套数组类型JSX（比如这个Demo）时，由于实现的updateFromMap方法中没有考虑传入的element可能为数组形式：会导致element为数组形式时keyToUse为undefined，进而导致Fragment不能复用，造成bug。
  return (
    <div onClick={() => {
      setNum(num => num + 1);
      setNum(num => num + 1);
      setNum(num => num + 1);
    }}>
      {num}
    </div>
  );
}

function Child() {
  const [num, setNum] = useState(10);
  window.setNum = setNum
  console.log('num', num)
  return num === 3 ? <span>{num}</span> : 111
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
)
