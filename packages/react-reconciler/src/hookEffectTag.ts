// 不同的effect共用同一个机制（useEffect、useLayoutEffect、useInsertionEffect）（用不同的tag来做区分）
export const Passive = 0b0010;  // Passive代表useEffect
// export const Layout = 0b0100;  // Layout代表useLayoutEffect

// 是否需要触发回调
export const HookHasEffect = 0b0001;