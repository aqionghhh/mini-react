export type Flags = number;

export const NoFlags = 0b0000000; // 没有标记
export const Placement = 0b0000001; // 插入（结构相关，如：插入： a -> ab  移动： abc -> bca）
export const Update = 0b0000010;  // 更新（属性相关，如：<img title="aqiong" /> -> <img title="hhh" />）
export const ChildDeletion = 0b0000100; // 删除子节点（结构相关，如：ul>li*3 -> ul>li*1）

// 对于fiber，新增PassiveEffect，代表「当前fiber本次更新存在副作用」
export const PassiveEffect = 0b0001000; // 表示在当前fiber上 本次更新存在需要触发useEffect的情况
export const Ref = 0b0010000; // 

// mutation阶段需要执行的操作
// 在mutation阶段，如果有需要对ref进行操作的话，那就是解绑之前的ref
export const MutationMask = Placement | Update | ChildDeletion | Ref;
// layout阶段需要执行的操作
// 在layout阶段，如果有需要对ref进行操作的话，那就是绑定新的ref
export const LayoutMask = Ref;

export const PassiveMask = PassiveEffect | ChildDeletion;  // 对于一个函数组件，卸载时（ChildDeletion）需要触发useEffect中的destroy函数（return出来的函数）
