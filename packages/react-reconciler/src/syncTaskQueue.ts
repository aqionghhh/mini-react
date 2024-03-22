// 用于保存同步调度的逻辑

let syncQueue: ((...arg: any) => void)[] | null = null;
let isFlushingSyncQueue = false; // 当前是否正在执行回调函数

export function scheduleSyncCallback(callback: (...arg: any) => void) {  // 调度同步的回调函数
  if (syncQueue === null) { // 传入的回调函数是同步调度的第一个函数
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

export function flushSyncCallbacks() {  // 遍历执行同步的回调函数
  if (!isFlushingSyncQueue && syncQueue) {
    isFlushingSyncQueue = true;
    try {
      syncQueue.forEach(callback => callback());
    } catch (e) {
      if (__DEV__) {
        console.error('flushSyncCallbacks报错', e);
      }
    } finally {
      isFlushingSyncQueue = false;
    }
  }
}
