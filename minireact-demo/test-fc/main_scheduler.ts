// 类比react执行过程（并发更新demo）
// 并发更新的基础是「时间切片」 (时间切片就是将长的任务切割成短的任务)

// 数字越小 优先级越高
import {
  unstable_ImmediatePriority as ImmediatePriority, // 对应同步更新  // 对应优先级：1
  unstable_UserBlockingPriority as UserBlockingPriority, // eg: 点击事件  // 对应优先级：2
  unstable_NormalPriority as NormalPriority,  // 正常的优先级  // 对应优先级：3
  unstable_LowPriority as LowPriority,  // 低优先级  // 对应优先级：4
  unstable_IdlePriority as IdlePriority,  // 空闲时的优先级  // 对应优先级：5
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,  // 当前时间切片是否用尽
  CallbackNode,
  unstable_getFirstCallbackNode as getFirstCallbackNode,  // 取到当前正在调度的回调
  unstable_cancelCallback as cancelCallback // 取消调度
} from 'scheduler'
import './style.css';

const root = document.querySelector('#root');

type Priority = typeof IdlePriority | typeof LowPriority | typeof NormalPriority | typeof UserBlockingPriority | typeof ImmediatePriority;

// 交互时会创建一个数据结构
interface Work {
  count: number;  // 代表某个工作要执行的次数；类比react中组件的数量(需要render的次数)
  priority: Priority
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;  // 上一次更新的优先级
let curCallback: CallbackNode | null = null; // 当前调度的回调函数

// 创建不同优先级对应的button
[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(priority => {
  const btn = document.createElement('button');
  root?.appendChild(btn);
  btn.innerText = ['', 'ImmediatePriority', 'UserBlockingPriority', 'NormalPriority', 'LowPriority'][priority];
  btn.onclick = () => {
    workList.unshift({
      count: 100, // 假设为100
      priority: priority as Priority
    });
    schedule();
  }
})

// 调度
function schedule() {
  const cbNode = getFirstCallbackNode();
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];  // 找到优先级最高的work
  
  // 策略逻辑
  if (!curWork) { // work取完了
    curCallback = null;
    cbNode && cancelCallback(cbNode); // 取消调度
    return;
  }
  const { priority: curPriority } = curWork;
  if (curPriority === prevPriority) {
    return;
  }

  // 更高优先级的work
  cbNode && cancelCallback(cbNode); // 取消调度（把当前正在调度的work取消掉）

  // schedule
  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));  // scheduleCallback执行 返回当前调度的回调函数
}

function perform(work: Work, didTimeout?: boolean) {  // didTimeout标记当前work是否过期，如果已经过期了，那么就应该同步执行
  /**
   * 哪些情况下可以影响它是否可以中断：
   * 1. work.priority是ImmediatePriority （不能中断，因为ImmediatePriority是同步优先级）
   * 2. 饥饿问题（eg：有一个work竞争不过别的work，那就一直得不到执行）（在scheduler中，如果一个work一直得不到执行，那么它的优先级就会越来越高；直到它过期，被同步执行）
   * 3. 时间切片（当前时间切片的时间用尽了，就会停下来让浏览器进行渲染，等下一次再进行循环）
   */
  const needSync = work.priority === ImmediatePriority || didTimeout; // 是否需要同步执行

  while ((needSync || !shouldYield()) && work.count) {  // (当前需要同步执行 || 当前时间切片没有用尽) && work.count还有值
    work.count--;
    insertSpan(work.priority + '');
  }
  
  // 执行完 或 中断执行
  prevPriority =work.priority;
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1); // 移除该work
    prevPriority = IdlePriority;
  }

  const prevCallback = curCallback;
  schedule();
  const newCallback = curCallback;

  if (newCallback && prevCallback === newCallback) {  // 如果这两个值一致的话，说明schedule中走到了if语句里，return掉了
    return perform.bind(null, work);
  }
}

function insertSpan(content) {
  const span = document.createElement('span');
  span.innerText = content;
  span.className = `pri-${content}`;
  doSomeBusyWork(11100111); // 让渲染效果更明显
  root?.appendChild(span);
}

function doSomeBusyWork(len: number) {
  let res = 0;
  while (len --) {
    res += len;
  }
}