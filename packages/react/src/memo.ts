import { FiberNode } from "react-reconciler/src/fiber";
import { REACT_MEMO_TYPE } from "shared/ReactSymbols";
import { Props } from "shared/ReactTypes";

// memo接收两个参数
// React.memo(function APP() {...}, )

// 第一个参数：函数组件，函数组件的本质其对应的fiber节点的type属性
// 第二个参数（可选）：比较的函数，函数接收oldProps以及newProps
export function memo(type: FiberNode['type'], compare?: (oldProps: Props, newProps: Props) => boolean) {
  const fiberType = {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare,
  }

  // fiberType最终会变成 memo组件对应的fiber.type；所以fiber.type.type就对应了这个函数组件
  return fiberType;
}
