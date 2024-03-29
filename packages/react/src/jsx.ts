import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Type, Key, Props, Ref, ElementType, ReactElementType } from 'shared/ReactTypes';
//ReactElement(ReactElement是一个跟宿主环境无关的数据结构，所以其类型定义应该写在shared这个包中)

const ReactElement = function (type: Type, key: Key, ref: Ref, props: Props): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE, // 需要用一个内部变量区分当前数据结构是一个ReactElement
		key,
		ref,
		props,
    type,
		__mark: 'xq' // 为了将自己的ReactElement和项目中的ReactElement作区分；自己的自定义字段，真实React包中无该字段
	};

	return element;
};

export function isValidElement(object: any) {
	return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE; 
}

export const Fragment = REACT_FRAGMENT_TYPE;

// <div id="333">123</div>
// 注意：jsx和createElement方法接收的参数不同，详情可自行在babel官网查看
export const createElement = (type: ElementType, config: any, ...maybeChildren: any) => {
  // 处理config：在createElement里有俩个特殊的props需要注意：一个是key，一个是ref，需要单独处理这两个值
  const props: Props = {};
  let key: Key = null;
  let ref: Ref = null;

  for (const prop of config) {
    const val = config[prop];
    //  处理两个特殊值
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }
    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }
    if ({}.hasOwnProperty.call(config, props)) {
      props[prop] = val;
    }
  }

  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength) {  // 存在多余的children
    // 存在两种情况：[child]  [child, child, child]
    if (maybeChildrenLength === 1) {  // 长度为1时，就可以直接赋值
      props.children = maybeChildren[0];
    } else {
      props.children = maybeChildren;
    }
  }

  return ReactElement(type, key, ref, props);
};

export const jsx = (type: ElementType, config: any, maybeKey: any) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	if (maybeKey !== undefined) {
		key = '' + maybeKey;
	}

	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') { // 感觉这里不需要这个if判断？？？
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};

export const jsxDEV = jsx;
