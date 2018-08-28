import * as React from 'react';
import { connect as defaultConnect } from 'react-redux';
import { Dispatch, Action } from 'redux';

export interface ActionProps<Actions extends Action> {
  dispatch: Dispatch<Actions>;
}

export function connect<
  Store,
  ComponentClass extends React.ComponentClass<StoreProps & ActionProps<Actions> & ComponentProps, State>,
  StoreProps,
  ComponentProps,
  Actions extends Action,
  State,
>
(component: ComponentClass, mapStoreProps: (store: Store) => StoreProps): React.ComponentClass<ComponentProps> {
  return defaultConnect<StoreProps, ActionProps<Actions>, ComponentProps>(
    mapStoreProps,
    (dispatch: Dispatch<Actions>): ActionProps<Actions> => ({ dispatch: dispatch }),
  )(component);
}
