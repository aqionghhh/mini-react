// 创建ReactDOM与Reconciler的连接
// 合成事件文件，存放与ReactDOM相关的事件系统
import { Container } from 'hostConfig';
import { unstable_ImmediatePriority, unstable_NormalPriority, unstable_UserBlockingPriority, unstable_runWithPriority } from 'scheduler';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';
const validEventTypeList = ['click']; // 支持的事件列表

type EventCallback = (e: Event) => void;

interface SyntheticEvent extends Event {
  __stopPropagation: boolean, //  阻止事件传递
}

interface Paths {
  capture: EventCallback[],
  bubble: EventCallback[]
}

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

// dom[xxx] = reactElement props
export function updateFiberProps(node: DOMElement, props: Props) {  // 
  node[elementPropsKey] = props;
}

export function initEven(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn('当前不支持', eventType, '事件');
  }

  if (__DEV__) {
    console.warn('初始化事件：', eventType);
  }

  // 将事件全部代理到container上
  container.addEventListener(eventType, e => {
    dispatchEvent(container, eventType, e);
  })
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;

  if (targetElement === null) {
    console.warn('事件不存在target', e);
    return;
  }

  // 1. 收集沿途的事件（targetElement到container之间的所有domElement中的事件回调）
  const { bubble, capture } = collectPaths(targetElement as DOMElement, container, eventType);
  // 2. 构造合成事件
  const se = createSyntheticEvent(e);
  // 先是capture（捕获阶段），后是bubble（冒泡阶段）
  // 3. 遍历capture
  triggerEventFlow(capture, se);
  if (!se.__stopPropagation) {
    // 4. 遍历bubble
    triggerEventFlow(bubble, se);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    // 将当前上下文环境对应的优先级改成传入的优先级
    unstable_runWithPriority(evenTypeToSchedulerPriority(se.type), () => {
      callback.call(null,se);
    });
    if (se.__stopPropagation) { // 阻止事件继续传播
      break;
    }
  }
}

// 创建合成事件
function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;

  const originStopPropagation = e.stopPropagation;
  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };

  return syntheticEvent;
}

// 获取事件的回调名（映射关系）
function getEventCallbackNameFromEventType(eventType: string): string[] | undefined {
  return {
    click: ['onClickCapture', 'onClick']  // 第0项对应捕获阶段，第1项对应冒泡阶段；需要注意顺序
  }[eventType];
}

function collectPaths(targetElement: DOMElement, container: Container, eventType: string) { // targetElement: 事件源
  const paths: Paths = {
    capture: [],
    bubble: []
  };

  while (targetElement && targetElement !== container) {
    // 收集
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) { // eg：props传入的如果是点击事件，那么拿到eventType是click，但实际上要取到onClick和onClickCapture的回调
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              // capture
              // 为什么反向插入：eg：
              // div  container   onClick onClickCapture
              //  div   onClick onClickCapture
              //   p  targetElement   onClick
              // 例如有三个嵌套的dom元素，有各自的点击事件，那么会按照如下顺序存入到数组中：
              // bubble  [p onClick, div onClick, container, onClick]
              // capture  [container onClickCapture, div onClickCapture]
              // 会看到capture数组的顺序是从container到目标元素，是一个从上往下，是模拟捕获阶段的事件回调触发
              // bubble是从目标元素到container，是从下往上，是冒泡阶段的事件回调触发
              paths.capture.unshift(eventCallback);
            } else {
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement; // 从事件源开始 向上遍历
  }
  return paths;
}

// 通过事件类型 转换到调度器的优先级
function evenTypeToSchedulerPriority (eventType: string) {
  switch (eventType) {
    // 同步优先级，优先级：1
    case 'click':
    case 'keydown':
    case 'keyup':
      return unstable_ImmediatePriority;
    // 优先级：2
    case 'scroll':
      return unstable_UserBlockingPriority;
    // 优先级：3
    default:
      return unstable_NormalPriority;
  }
}