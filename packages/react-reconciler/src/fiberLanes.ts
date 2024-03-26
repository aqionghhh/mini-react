import { unstable_IdlePriority, unstable_ImmediatePriority, unstable_NormalPriority, unstable_UserBlockingPriority, unstable_getCurrentPriorityLevel } from "scheduler";
import { FiberRootNode } from "./fiber";

// Lane模型，所谓的Lane 是一个二进制的数字
export type Lane = number;  // 作为update的优先级
export type Lanes = number; // 代表lane的集合

// 数字越小，优先级越高（0除外，0没有优先级）
export const SyncLane = 0b0001; // 同步优先级
export const InputContinuousLane = 0b0010; // 比如：连续的输入 
export const DefaultLane = 0b0100; // 默认的优先级
export const IdleLane = 0b1000; // 空闲时的优先级
export const NoLane = 0b0000; // 没有优先级
export const NoLanes = 0b0000; // 没有优先级

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
  // 从上下文环境中获取scheduler优先级
  // 与triggerEventFlow函数衔接上了
  const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
  // 根据不同的上下文，返回不同的优先级（不同的更新，拥有不同的优先级；这是并发更新的基础）
}

// 实现判断机制，选出一个lane(选出优先级最高的lane)
export function getHighestPriority(lanes: Lanes): Lane {
  return lanes & -lanes;
}

// 比较优先级是否足够
export function isSubsetOfLanes(set: Lanes, subSet:Lane) {
  // 查看一个lane是否在lanes中，如果在的话，代表优先级足够；不在的话代表优先级不够
  // 取交集
  // NoLane跟任何优先级的取交集都是NoLane；所以传入的subSet是NoLane的话，优先级都会足够
  return (set & subSet) === subSet; // 如果相等，就代表优先级足够
}

// 从fiberRootNode中移除lane
export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

// 从lane转换到调度器优先级
export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriority(lanes);  // 获取最高优先级的lane

  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

// 从调度器优先级转成lane
export function schedulerPriorityToLane(schedulerPriority: number) {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;  // NoLane对应unstable_IdlePriority
}