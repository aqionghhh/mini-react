import { FiberNode } from "./fiber";
import { popProvider } from "./fiberContext";
import { DidCapture, NoFlags, ShouldCapture } from "./fiberFlags";
import { popSuspenseHandler } from "./suspenseContext";
import { ContextProvider, SuspenseComponent } from "./workTags";

export function unwindWork(wip: FiberNode) {
  const flags = wip.flags;

  switch (wip.tag) {
    case SuspenseComponent:
      popSuspenseHandler(); // 因为unwind和completeWork一样，是向上的过程，所以这个栈需要pop
      if ((flags & ShouldCapture) !== NoFlags && (flags & DidCapture) === NoFlags) {  // 找到了抛出内容的fiber 最近的suspense
        wip.flags = (flags & ~ShouldCapture) | DidCapture;  // 移除ShouldCapture，再加上DidCapture
        return wip; // 返回这个最近的suspense
      }
      break;
    case ContextProvider:
      const context = wip.type._context;
      popProvider(context);
      return null;
      
    default:
      return null;
  }
  return null;
}