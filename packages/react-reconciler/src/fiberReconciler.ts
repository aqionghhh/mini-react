// 实现mount时调用的API
import { Container } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { HostRoot } from "./workTags";
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from "./updateQueue";
import { ReactElementType } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { requestUpdateLane } from "./fiberLanes";
import { unstable_ImmediatePriority, unstable_runWithPriority } from "scheduler";


export function createContainer(container: Container) { // 执行ReactDOM.createRoot()时，就会执行该函数
  // 新建fiberRootNode和hostRootFiber，并让两者产生关联
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);

  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
}

export function updateContainer(element: ReactElementType | null, root: FiberRootNode) {  // 接着执行ReactDOM.createRoot().render()的render方法时，就会执行该函数
  // 默认启用同步更新
  unstable_runWithPriority(unstable_ImmediatePriority, () => {  // 使用同步优先级
    const hostRootFiber = root.current;
    
    const lane = requestUpdateLane(); // 这里获取到的lane就是同步优先级的lane
  
    // 首屏渲染触发同步更新
    const update = createUpdate<ReactElementType | null>(element, lane);
    enqueueUpdate(hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>, update);
  
    scheduleUpdateOnFiber(hostRootFiber, lane);
  });

  return element;
}