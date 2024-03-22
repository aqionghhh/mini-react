import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

// 对于React来说，有两种触发更新的方式，比如说：
// this.setState({xxx: 1})
// this.setState((xx) => {xx: 2}) // 返回值作为状态的最新值

export interface Update<State> {
  action: Action<State>; // Action要能够接收两种形式
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  // 为什么UpdateQueue是这样的一个结构：因为在createWorkInProgress函数中，能让wip和current共用同一个updateQueue
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;  // 为了兼容hooks；扩展一个dispatch方法，用于保存hooks的dispatch
}

// 创建Update实例的方法：createUpdate
export const createUpdate = <State>(action: Action<State>, lane: Lane): Update<State> => {  // lane在这代表当前update的优先级 

  // 返回一个update实例
  return {
    action,
    lane,
    next: null
  }
}

// 创建updateQueue实例的方法：createUpdateQueue
export const createUpdateQueue = <State>() => {

  return {
    shared: {
      pending: null
    },
    dispatch: null,
  } as UpdateQueue<State>;
}

// 往updateQueue里增加update的方法
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  // updateQueue.shared.pending = update; // 原先版本，update直接覆盖
  // 现在改为环状链表的形式
  const pending = updateQueue.shared.pending;
  if (pending === null) { // 当前updateQueue中还未插入update
    // 假设传入的update为a，那么a.next指向a
    update.next = update; // 指向自己
  } else {
    // 比如第二次传入的update为b，那么b.next指向a.next
    // 第三次传入的update为c，那么c.next指向b.next
    update.next = pending.next;
    // 第二次：a.next指向b
    // 第三次：b.next指向c
    pending.next = update;
  }
  // 第一次updateQueue.shared.pending指向a
  // 第二次：pending = b -> a -> b
  // 第三次：pending = c -> a -> b -> c
  // 即一个环状链表，pending始终指向最后插入的update
  updateQueue.shared.pending = update;
}

// updateQueue消费update的方法
export const processUpdateQueue = <State>(
  baseState: State, // 初始状态
  pendingUpdate: Update<State> | null, // 要消费的update
  renderLane: Lane
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = { memoizedState: baseState };

  if (pendingUpdate !== null) { // 存在两种情况
    // 拿到第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {  // updateLane和本次更新的renderLane一致的话，再执行计算
        const action = pending.action;
    
        if (action instanceof Function) {
          // 如果baseState是1，update是2，那么memoizedState就是2
          baseState = action(baseState);
        } else {
          // 如果baseState是1，update是(x) => 4x，那么memoizedState就是4
          // action也有可能是ReactElement
          baseState = action;
        }
      } else {  // 不一致
        if (__DEV__) {
          console.warn('不应该进入');
        }
      }

      pending = pending.next as Update<any>; // 遍历下一个
    } while (pending !== first);
  }
  result.memoizedState = baseState;

  return result;
}
