// 类比react执行过程（同步更新demo）

import './style.css';

const button = document.querySelector('button');
const root = document.querySelector('#root');

// 交互时会创建一个数据结构
interface Work {
  count: number;  // 代表某个工作要执行的次数；类比react中组件的数量(需要render的次数)
}

const workList: Work[] = [];
// 调度
function schedule() {
  const curWork = workList.pop();

  if (curWork) {
    perform(curWork);
  }
}

function perform(work: Work) {
  while (work.count) {
    work.count--;
    insertSpan('0');
  }
  
  schedule(); // 执行完继续调度
}

function insertSpan(content) {
  const span = document.createElement('span');
  span.innerText = content;
  root?.appendChild(span);
}

button && (button.onclick = () => {
  // 点击button之后将work插入到workList中
  workList.unshift({
    count: 100, // 假设为100
  });
  schedule();
});