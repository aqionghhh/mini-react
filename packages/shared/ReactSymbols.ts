const supportSymbol = typeof Symbol === 'function' && Symbol.for; // 判断当前宿主环境是否支持Symbol

// 如果支持的话，通过Symbol创建一个独一无二的值；否则通过一个数字0xeac7来表示
export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;
