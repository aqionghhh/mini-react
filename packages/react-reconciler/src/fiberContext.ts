import { ReactContext } from "shared/ReactTypes";

// const ctx = createContext(0);

// <ctx.Provider value={1}>
//   <Cpn />
// </ctx.Provider>
//   <Cpn />
// 对于上述例子，在第一个<Cpn />中获取到的值是1，而第二个<Cpn />得到的值是0
// 所以在ctx.Provider的beginWork时，修改ctx的值；在ctx.Provider的completeWork时将值还原成原来的旧值

let prevContextValue: any = null;  // 上一个contextValue
const prevContextValueStack: any[] = [];  // 因为会出现context嵌套的情况，所以需要一个栈来保存contextValue的旧值

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue);

  prevContextValue = context._currentValue;
  context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
  context._currentValue = prevContextValue;
  
  prevContextValue = prevContextValueStack.pop();
}
