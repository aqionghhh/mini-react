import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes';

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
): { 
  memoizedState: State;
  baseState: State;
  baseQueue: Update<State> | null
  } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = { 
    memoizedState: baseState, 
    baseState, 
    baseQueue: null 
  };

  if (pendingUpdate !== null) { // 存在两种情况
    // 拿到第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    let newBaseState = baseState; // 保存变化后的baseState
    let newBaseQueueFirst: Update<State> | null = null;// 保存baseQueue的链表头
    let newBaseQueueLast: Update<State> | null = null;// 保存baseQueue的链表尾
    let newState = baseState; // 一次计算后，计算出的结果

    do {
      const updateLane = pending.lane;
      // renderLane：本次更新的lane
      // updateLane：传入的lane
      if (!isSubsetOfLanes(renderLane, updateLane)) {  // 查看优先级是否足够
        // 优先级不够，被跳过
        // 如果本次更新有update被跳过，则本次更新计算出的memoizedState为「考虑优先级」情况下计算的结果，
        // baseState为「最后一个没被跳过的update计算后的结果」，下次更新开始时baseState !== memoizedState
        const clone = createUpdate(pending.action, pending.lane); // 被跳过的update
        // 判断是否是第一个被跳过的update
        if (newBaseQueueFirst === null) { // 第一个被跳过的
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          // newBaseQueue的指针往后走
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        // 判断之前是否存在被跳过的update
        if (newBaseQueueLast !== null) {  // 存在
          // 本次更新「被跳过的update及其后面的所有update」都会被保存在baseQueue中参与下次state计算
          const clone = createUpdate(pending.action, NoLane); // 被跳过的update
          // 本次更新「参与计算但保存在baseQueue中的update」，优先级会降低到NoLane
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

        
        const action = pending.action;
    
        if (action instanceof Function) {
          // 如果baseState是1，update是2，那么memoizedState就是2
          newState = action(baseState);
        } else {
          // 如果baseState是1，update是(x) => 4x，那么memoizedState就是4
          // action也有可能是ReactElement
          newState = action;
        }
      }

      pending = pending.next as Update<any>; // 遍历下一个
    } while (pending !== first);

    if (newBaseQueueLast === null) {  // 本次计算没有update被跳过，代表baseState === memoizedState
      newBaseState = newState;
    } else {  // 本次计算有update被跳过；newBaseQueueFirst与newBaseQueueLast要合成一条环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memoizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }
  return result;
}
