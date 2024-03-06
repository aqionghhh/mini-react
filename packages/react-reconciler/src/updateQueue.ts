import { Action } from 'shared/ReactTypes';

// 对于React来说，有两种触发更新的方式，比如说：
// this.setState({xxx: 1})
// this.setState((xx) => {xx: 2}) // 返回值作为状态的最新值

export interface Update<State> {
  action: Action<State>; // Action要能够接收两种形式
}

export interface UpdateQueue<State> {
  // 为什么UpdateQueue是这样的一个结构：因为在createWorkInProgress函数中，能让wip和current共用同一个updateQueue
  shared: {
    pending: Update<State> | null;
  }
}

// 创建Update实例的方法：createUpdate
export const createUpdate = <State>(action: Action<State>): Update<State> => {

  // 返回一个update实例
  return {
    action
  }
}

// 创建updateQueue实例的方法：createUpdateQueue
export const createUpdateQueue = <Action>() => {

  return {
    shared: {
      pending: null
    }
  } as UpdateQueue<Action>;
}

// 往updateQueue里增加update的方法
export const enqueueUpdate = <Action>(
  updateQueue: UpdateQueue<Action>,
  update: Update<Action>
) => {
  updateQueue.shared.pending = update
}

// updateQueue消费update的方法
export const processUpdateQueue = <State>(
  baseState: State, // 初始状态
  pendingUpdate: Update<State> // 要消费的update
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = { memoizedState: baseState };

  if (pendingUpdate !== null) { // 存在两种情况
    const action = pendingUpdate.action;

    if (action instanceof Function) {
      // 如果baseState是1，update是2，那么memoizedState就是2
      result.memoizedState = action(baseState);
    } else {
      // 如果baseState是1，update是(x) => 4x，那么memoizedState就是4
      result.memoizedState = action;
    }
  }

  return result;
}
