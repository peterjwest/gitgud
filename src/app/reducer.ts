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
  fileSelection: {
    files: string[];
    staged: boolean;
  };
  lineSelection: {
    lines: string[];
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
  fileSelection: {
    files: [],
    staged: false,
  },
  lineSelection: {
    lines: [],
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
    return { ...store, fileSelection: { files: action.files, staged: action.staged }};
  }
  if (action.type === 'UpdateSelectedLines') {
    return { ...store, lineSelection: { lines: action.lines }};
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

export interface UpdateSelectedLines {
  type: 'UpdateSelectedLines';
  lines: string[];
}

export type AppAction = UpdateRepoAction | UpdateStatusAction | UpdateFileDiff | UpdateSelectedFiles | UpdateSelectedLines;
