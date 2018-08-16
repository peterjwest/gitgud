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
  if (action.type === 'UPDATE_REPO') {
    return { ...store, name: action.name, branch: action.branch };
  }
  if (action.type === 'UPDATE_STATUS') {
    return { ...store, status: { ...store.status, files: action.files }};
  }
  return store;
};

export interface UpdateRepoAction {
  type: 'UPDATE_REPO';
  name: string;
  branch: string;
}

export interface UpdateStatusAction {
  type: 'UPDATE_STATUS';
  files: FileStatus[];
}

export type AppAction = UpdateRepoAction | UpdateStatusAction;
