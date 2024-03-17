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
  const [num] = useState(10);
  return (
    <span>{num}</span>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
)
