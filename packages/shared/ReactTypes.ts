export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: string;
}

export type Action<State> = State | ((prevState: State) => State);	// 对应两种触发更新的方式

export type ReactProviderType<T> = {
	$$typeof: symbol | number;
	_context: ReactContext<T> | null;	// 指向对应的ReactContext
}

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Provider: ReactProviderType<T> | null; // 对应了context.Provide
  _currentValue: T  // 保存context当前的值
};

export type Usable<T> = Thenable<T> | ReactContext<T>;

export interface Wakeable<Result> { 
	then(
		onFulfilled: () => Result, 
		onRejected: () => Result
	): void | Wakeable<Result>
}

// Thenable存在四种状态： 1. untracked 未追踪		2. pending 等待 	3. fulfilled 相当于resolve		4. rejected 相当于reject
export interface ThenableImpl<T, Result, Err> { 
	then(
		onFulfilled: (value: T) => Result, 
		onRejected: (value: Err) => Result
	): void | Wakeable<Result>
}

// 定义四种thenable的实现
export interface UntrackedThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status?: void;	// 状态
}
export interface PendingThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status: 'pending';
}
export interface FulfilledThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status: 'fulfilled';
	value: T;	// 返回值
}
export interface RejectedThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
	status: 'rejected';
	reason: Err;	// 错误原因
}

export type Thenable<T, Result = void, Err = any> = 
	UntrackedThenable<T, Result, Err> | 
	PendingThenable<T, Result, Err> | 
	FulfilledThenable<T, Result, Err> | 
	RejectedThenable<T, Result, Err>;
