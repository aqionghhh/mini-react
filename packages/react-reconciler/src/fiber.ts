// 用于存放fiberNode数据结构
import { Props, Key, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig'; // 在tsconfig中进行了配置，这里不用写死路径

export class FiberNode {
  type: any;
  tag: any;
  pendingProps: Props;
  key: Key;
  stateNode: any;
  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;
  ref: Ref;
  memoizedProps: Props | null;
  memoizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  updateQueue: unknown;

  // pendingProps是接下来有哪些props需要改变；key对应了ReactElement的key；tag是fiberNode是怎样的一个节点
  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例属性
    this.tag = tag; 
    this.key = key;
    // 对于一个HostComponent来说，比如说HostComponent是一个div的话，stateNode就保存了div这个DOM
    this.stateNode = null;
    this.type = null; ///fiberNode的类型，比如说对于FunctionComponent，那么它的type就是function本身，即() => {}

    // 构成树状结构
    // fiberNode除了作为一个实例，它还需要一些字段用来表示节点之间的关系
    this.return = null; // return指向父fiberNode
    this.sibling = null;  // 指向右fiberNode
    this.child = null;  // 指向子fiberNode
    this.index = 0; // 表示同级的fiberNode的序号，比如说一个ul标签里有三个li标签，index可以为0、1、2来表示当前的fiberNode是第几个li标签

    this.ref = null;

    // 作为工作单元
    this.pendingProps = pendingProps; // 这个工作单元刚开始准备工作的时候，确定下来的props是什么
    this.memoizedProps = null; // 这个工作单元工作完成的时候，确定下来的props是什么
    this.memoizedState = null; // 更新完后新的state
    this.updateQueue = null;

    // 如果当前的fiberNode是current，那么alternate就指向workInProgress，反之则指向current
    this.alternate = null;  // 用于两个fiberNode之间进行切换
    // 将flags统称为副作用
    this.flags = NoFlags; // 标记
  }

};

// 执行React.createRoot()统一创建的fiberRootNode
export class FiberRootNode {
  container: Container;  // 对于浏览器（DOM环境）来说，这个container就是DOM节点；对于其他宿主环境，container就对应其他节点
  current: FiberNode; // fiberRootNode的current字段指向hostRootFiber，即传入的rootElement对应的fiber节点
  finishedWork: FiberNode | null; // 指向更新完成后的hostRootFiber（完成整个递归流程的hostRootFiber）

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this; // hostRootFiber的stateNode指向fiberRootNode
    this.finishedWork = null;
  }

}

export const createWorkInProgress = (current: FiberNode, pendingProps: Props): FiberNode => { // 因为FiberNode是双缓存机制，所以每次都获取当前节点相对应的fiberNode
  let wip = current.alternate;  // wip：workInProgress缩写

  if (wip === null) { // 首屏渲染为null，即mount阶段
    // mount
    wip = new FiberNode(current.tag, current.pendingProps, current.key);
    wip.type = current.type;
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;  // 清除副作用
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;

  return wip;
}