const supportSymbol = typeof Symbol === 'function' && Symbol.for; // 判断当前宿主环境是否支持Symbol

// ReactElement的type属性
// 如果支持的话，通过Symbol创建一个独一无二的值；否则通过一个数字0xeac7来表示
export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
	? Symbol.for('react.fragment')
	: 0xeacb;

export const REACT_CONTEXT_TYPE = supportSymbol
	? Symbol.for('react.context')
	: 0xeacc;

export const REACT_PROVIDER_TYPE = supportSymbol
	? Symbol.for('react.provider')
	: 0xeac2;