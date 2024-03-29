import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } from 'shared/ReactSymbols';
import { ReactContext } from 'shared/ReactTypes';

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    Provide: null,
    _currentValue: defaultValue,
  };

  context.Provide = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,  // 指向对应的context
  };

  return context;
}
