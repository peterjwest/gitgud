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
  selection: {
    files: string[];
    staged: boolean;
  };
  diff?: string;
  lineCount: number;
}

export const defaultStore: Store = {
  name: undefined,
  branch: undefined,
  status: {
    files: [],
  },
  selection: {
    files: [],
    staged: false,
  },
  diff: undefined,
  lineCount: 0,
};

export default (store = defaultStore, action: AppAction): Store => {
  if (action.type === 'UpdateRepoAction') {
    return { ...store, name: action.name, branch: action.branch };
  }
  if (action.type === 'UpdateStatusAction') {
    return { ...store, status: { ...store.status, files: action.files }};
  }
  if (action.type === 'UpdateFileDiff') {
    return { ...store, diff: action.diff, lineCount: action.lineCount };
  }
  if (action.type === 'UpdateSelectedFiles') {
    return { ...store, selection: { files: action.files, staged: action.staged }};
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

export interface UpdateFileDiff {
  type: 'UpdateFileDiff';
  diff: string;
  lineCount: number;
}
export interface UpdateSelectedFiles {
  type: 'UpdateSelectedFiles';
  files: string[];
  staged: boolean;
}

export type AppAction = UpdateRepoAction | UpdateStatusAction | UpdateFileDiff | UpdateSelectedFiles;
