import * as React from 'react';
import { connect as defaultConnect } from 'react-redux';
import { Dispatch, Action } from 'redux';

export function connect<
  Store, StoreProps, Actions extends Action,
  ComponentClass extends React.ComponentClass<Props, State>, Props extends StoreProps, State
>
(component: ComponentClass, mapStoreProps: (store: Store) => StoreProps) {
  return defaultConnect<StoreProps, ActionProps<Actions>>(mapStoreProps,
    (dispatch: Dispatch<Actions>): ActionProps<Actions> => ({ dispatch: dispatch }),
  )(component);
}

export interface ActionProps<Actions extends Action> {
  dispatch: Dispatch<Actions>;
}
