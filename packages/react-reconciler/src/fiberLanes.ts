import { FiberRootNode } from "./fiber";

// Lane模型，所谓的Lane 是一个二进制的数字
export type Lane = number;  // 作为update的优先级
export type Lanes = number; // 代表lane的集合

// 数字越小，优先级越高（0除外，0没有优先级）
export const SyncLane = 0b0001; // 同步优先级
export const NoLane = 0b0000; // 没有优先级
export const NoLanes = 0b0000; // 没有优先级

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
  return SyncLane;  // 因为现在只有一种优先级，所以暂时只接返回同步优先级
  // 根据不同的上下文，返回不同的优先级（不同的更新，拥有不同的优先级；这是并发更新的基础）
}

// 实现判断机制，选出一个lane(选出优先级最高的lane)
export function getHighestPriority(lanes: Lanes): Lane {
  return lanes & -lanes;
}

// 从fiberRootNode中移除lane
export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}