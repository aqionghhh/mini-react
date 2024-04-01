// 抛出错误的时候，会在这个文件中处理

import { Wakeable } from "shared/ReactTypes";
import { FiberRootNode } from "./fiber";
import { Lane, markRootPinged } from "./fiberLanes";
import { ensureRootIsScheduled, markRootUpdated } from "./workLoop";
import { getSuspenseHandler } from "./suspenseContext";
import { ShouldCapture } from "./fiberFlags";

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  // Error Boundary

  // thenable
  if (value !== null && typeof value === 'object' && typeof value.then === 'function') {  // 满足这三个情况下 是thenable
    const wakeable: Wakeable<any> = value;

    // 获取离当前的 抛出错误的 fiber最近的suspense
    const suspenseBoundary = getSuspenseHandler();
    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture;
    }

    attachPingListener(root, wakeable, lane);
  }
}

// 触发promise
function attachPingListener(root: FiberRootNode, wakeable: Wakeable<any>, lane: Lane) {
  let pingCache = root.pingCache;
  // WeakMap { promise: Set<Lane> }
  // 每个lane的更新，都是唤醒每个wakeable的更新
  let threadIDs: Set<Lane> | undefined;  // threadIDs：线程id

  if (pingCache === null) { // 不存在缓存
    threadIDs = new Set<Lane>();
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
    pingCache.set(wakeable, threadIDs);
  } else {
    // 缓存存在，需要找一下缓存中是否存在threadID
    threadIDs = pingCache.get(wakeable);
    if (threadIDs === undefined) {
      // 初始化一个线程id
      threadIDs = new Set<Lane>();
      pingCache.set(wakeable, threadIDs);
    }
  }

  if (!threadIDs.has(lane)) {  // 只有第一次进入时，需要调用wakeable的then方法
    // 第一次进入
    threadIDs.add(lane);

    function ping() {
      if (pingCache !== null) {
        pingCache.delete(wakeable);
      }
      markRootPinged(root, lane);
      // 触发一次新的更新
      markRootUpdated(root, lane);
      ensureRootIsScheduled(root);
    }

    wakeable.then(ping, ping);
  }
}