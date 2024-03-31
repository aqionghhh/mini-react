import { FulfilledThenable, PendingThenable, RejectedThenable, Thenable } from "shared/ReactTypes";

// 错误类型
export const SuspenseException = new Error('这不是真实的错误，是Suspense工作的一部分，如果捕获到这个错误，请将这个错误抛出去');

// 全局变量，用于保存thenable
let suspendedThenable: Thenable<any> | null = null;

export function getSuspenseThenable(): Thenable<any> {
  if (suspendedThenable === null) { // 当调用该函数时，全局状态下suspendedThenable不可能为null
    throw new Error('应该存在suspendedThenable，这是个bug');
  }

  const thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}

function noop() {}

// 将用户传入的promise包装成thenable
export function trackUsedThenable<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case 'fulfilled':
      // 当前promise已经resolve
      return thenable.value;
    case 'rejected':
      // 当前promise已经reject
      throw thenable.reason;
  
    default:
      // 默认情况下传入一个promise，是不存在status字段的，会直接进入default
      if (typeof thenable.status === 'string') {  //  存在status字段，表示已经包装过了
        thenable.then(noop, noop);  // 什么都不干
      } else {
        // 属于未追踪untracked状态
        // untracked

        // pending
        const pending = thenable as unknown as PendingThenable<T, void, any>;
        pending.status = 'pending';
        pending.then(
          val => {  // resolve
            if (pending.status === 'pending') { // 从pending状态转为fulfilled
              // @ts-ignore
              const fulfilled: FulfilledThenable<T, void, any> = pending;
              fulfilled.status = 'fulfilled';
              fulfilled.value = val;
            }
          },
          err => {  // reject
            if (pending.status === 'pending') { // 从pending状态转为rejected
              // @ts-ignore
              const rejected: RejectedThenable<T, void, any> = pending;
              rejected.status = 'rejected';
              rejected.reason = err;
            }
          }
        )
      }
      break;
  }

  suspendedThenable = thenable;
  // 抛出自己定义的错误类型（如果直接抛出thenable的错误类型，显得不优雅）
  throw SuspenseException;
}