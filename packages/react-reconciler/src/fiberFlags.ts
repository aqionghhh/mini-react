export type Flags = number;

export const NoFlags = 0b0000001; // 没有标记
export const Placement = 0b0000010; // 插入（结构相关，如：插入： a -> ab  移动： abc -> bca）
export const Update = 0b0000100;  // 更新（属性相关，如：<img title="aqiong" /> -> <img title="hhh" />）
export const ChildDeletion = 0b0001000; // 删除子节点（结构相关，如：ul>li*3 -> ul>li*1）
