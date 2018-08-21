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
  diff?: string;
}

export const defaultStore: Store = {
  name: undefined,
  branch: undefined,
  status: {
    files: [],
  },
  diff: undefined,
};

export default (store = defaultStore, action: AppAction): Store => {
  if (action.type === 'UpdateRepoAction') {
    return { ...store, name: action.name, branch: action.branch };
  }
  if (action.type === 'UpdateStatusAction') {
    return { ...store, status: { ...store.status, files: action.files }};
  }
  if (action.type === 'UpdateSelectedFile') {
    return { ...store, diff: action.diff };
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

export interface UpdateSelectedFile {
  type: 'UpdateSelectedFile';
  diff: string;
}

export type AppAction = UpdateRepoAction | UpdateStatusAction | UpdateSelectedFile;
