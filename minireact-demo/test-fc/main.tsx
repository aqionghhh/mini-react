import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(10);
  const arr = num % 2 === 0 ? [
    <li key="1">1</li>,
    <li key="2">2</li>,
    <li key="3">3</li>
  ] : [
    <li key="3">3</li>,
    <li key="2">2</li>,
    <li key="1">1</li>
  ]
  return (
    <div>
      {/* <Child /> */}
      <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>
    </div>
  )
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
