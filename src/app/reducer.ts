export interface FileStatus {
  path: string;
  status: number;
}

export interface Store {
  name?: string;
  branch?: string;
  status: {
    files: FileStatus[];
  };
}

export const defaultStore: Store = {
  name: undefined,
  branch: undefined,
  status: {
    files: [],
  },
};

export default (store = defaultStore, action: AppAction): Store => {
  if (action.type === 'UpdateRepoAction') {
    return { ...store, name: action.name, branch: action.branch };
  }
  if (action.type === 'UpdateStatusAction') {
    return { ...store, status: { ...store.status, files: action.files }};
  }
  return store;
};

export interface UpdateRepoAction {
  type: 'UpdateRepoAction';
  name: string;
  branch: string;
}

export interface UpdateStatusAction {
  type: 'UpdateStatusAction';
  files: FileStatus[];
}

export type AppAction = UpdateRepoAction | UpdateStatusAction;
