import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <Child />
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
