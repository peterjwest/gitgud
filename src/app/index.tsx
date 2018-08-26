import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as nodegit from 'nodegit';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import { Event } from 'electron';
import $ from 'classnames';

import reducer, { Store, FileStatus, AppAction } from './reducer';
import { connect, ActionProps } from './connect';
import { parsePatch, LineDiff, LineBreak } from '../git';

const IS_STAGED = (
  nodegit.Status.STATUS.INDEX_NEW |
  nodegit.Status.STATUS.INDEX_MODIFIED |
  nodegit.Status.STATUS.INDEX_DELETED |
  nodegit.Status.STATUS.INDEX_RENAMED |
  nodegit.Status.STATUS.INDEX_TYPECHANGE
);

interface AppStoreProps {
  name: string;
  branch: string;
  files: FileStatus[];
  diff?: string;
  lineCount: number;
  selection: {
    files: Set<string>;
    staged: boolean;
  };
}

interface AppProps extends AppStoreProps, ActionProps<AppAction> {}
interface AppState {}

interface ModifierKeys {
  Meta: boolean;
  Shift: boolean;
  Control: boolean;
  Alt: boolean;
}

class App extends React.Component<AppProps, AppState> {
  keys: ModifierKeys = {
    Meta: false,
    Shift: false,
    Control: false,
    Alt: false,
  };

  constructor(props: AppProps) {
    super(props);

    ipcRenderer.on('init', (event: Event, data: { path: string, branch: string }) => {
      this.props.dispatch({ type: 'UpdateRepoAction', name: path.basename(data.path), branch: data.branch });
    });

    ipcRenderer.on('status', (event: Event, data: { files: FileStatus[] }) => {
      this.props.dispatch({ type: 'UpdateStatusAction', files: data.files });
    });

    ipcRenderer.on('diff', (event: Event, data: { diff: string, lineCount: number }) => {
      this.props.dispatch({ type: 'UpdateFileDiff', diff: data.diff, lineCount: data.lineCount });
    });

    window.addEventListener('keydown', (event) => {
      if (this.keys.hasOwnProperty(event.key)) {
        this.keys[event.key as keyof ModifierKeys] = true;
      }
    }, true);

    window.addEventListener('keyup', (event) => {
      if (this.keys.hasOwnProperty(event.key)) {
        this.keys[event.key as keyof ModifierKeys] = false;
      }
    }, true);
  }

  componentWillReceiveProps(nextProps: AppProps) {
    if (nextProps.name !== this.props.name || nextProps.branch !== this.props.branch) {
      document.title = this.getTitle(nextProps);
    }
  }

  getTitle(props: AppProps) {
    return props.name ? `${props.name} (${props.branch || 'Branch does not exist yet'})` : 'Gitgud';
  }

  updateStatus() {
    ipcRenderer.send('status');
  }

  toggleStageFile(file: FileStatus, stage: boolean) {
    ipcRenderer.send(stage ? 'stage' : 'unstage', file);
  }

  fileDiff(file: FileStatus, staged: boolean) {
    ipcRenderer.send('diff', file, staged);
  }

  selectFile(file: FileStatus, staged: boolean) {
    let files: string[] = [file.path];
    if (this.props.selection.staged === staged && (this.keys.Meta || this.keys.Control)) {
      const existing = new Set(this.props.selection.files);
      if (existing.has(file.path)) {
        existing.delete(file.path);
      } else {
        existing.add(file.path);
      }
      files = Array.from(existing);
    }
    this.props.dispatch({ type: 'UpdateSelectedFiles', files: files, staged: staged });
    this.fileDiff(file, staged);
  }

  deselectFiles() {
    this.props.dispatch({ type: 'UpdateSelectedFiles', files: [], staged: false });
  }

  renderFileStatus(file: FileStatus, staged: boolean) {
    const selected = this.props.selection.staged === staged && this.props.selection.files.has(file.path);
    return (
      <li
        className={$('App_stageView_pane_file', { ['App_stageView_pane_file-selected']: selected })}
        onClick={(event) => event.stopPropagation()}
      >
        <label className={'App_stageView_pane_file_select'} >
          <input
            type="checkbox"
            name="selected"
            checked={selected}
            onClick={() => this.selectFile(file, staged)}
            value={file.path}
          /> {file.path}
        </label>
        <button className={'App_stageView_pane_file_action'} onClick={() => this.toggleStageFile(file, !staged)}>
          {staged ? 'Unstage' : 'Stage'}
        </button>
      </li>
    );
  }

  renderLine(line: LineDiff | LineBreak) {
    if (line.type === '.') {
      return (
        <div className={'App_diffView_line'}>
          <span className={'App_diffView_line_number'} data-line-number={'...'}/>
          <span className={'App_diffView_line_number'} data-line-number={'...'}/>
        </div>
      );
    }

    return (
      <div className={$(
        'App_diffView_line',
        {
          'App_diffView_line-addition': line.type === '+',
          'App_diffView_line-removal': line.type === '-',
        },
      )}>
        <span className={'App_diffView_line_number'} data-line-number={line.type !== '+' ? line.lineNumbers[0] : ''}/>
        <span className={'App_diffView_line_number'} data-line-number={line.type !== '-' ? line.lineNumbers[1] : ''}/>
        <span className={'App_diffView_line_type'} data-line-number={line.type}/>
        <pre className={'App_diffView_line_text'}>{line.text}</pre>
      </div>
    );
  }

  render() {
    const unstagedFiles = this.props.files.filter((file) => file.status & ~IS_STAGED);
    const stagedFiles = this.props.files.filter((file) => file.status & IS_STAGED);
    const lines = parsePatch(this.props.diff || '', this.props.lineCount);

    return (
      <div className={'App'}>
        <div className={'App_titlebar'}>
          <h1 className={'App_titlebar_title'}>
            {this.getTitle(this.props)} <button className={'App_titlebar_refresh'} onClick={() => this.updateStatus()}>Refresh</button>
          </h1>
        </div>
        <div className={'App_stageView'}>
          <div className={'App_stageView_pane App_stageView_pane-unstaged'}>
            <h2 className={'App_stageView_pane_title'}>Unstaged changes</h2>
            <ul className={'App_stageView_pane_content'} onClick={() => this.deselectFiles()}>
              {unstagedFiles.map((file) => this.renderFileStatus(file, false))}
            </ul>
          </div>
          <div className={'App_stageView_pane App_stageView_pane-staged'}>
            <h2 className={'App_stageView_pane_title'}>Staged changes</h2>
            <ul className={'App_stageView_pane_content'} onClick={() => this.deselectFiles()}>
              {stagedFiles.map((file) => this.renderFileStatus(file, true))}
            </ul>
          </div>
        </div>
        <div className={'App_diffView'}>
          <div className={'App_diffView_inner'}>
            {lines.map((line) => this.renderLine(line))}
          </div>
        </div>
      </div>
    );
  }
}

const AppContainer = connect(App, (store: Store): AppStoreProps => {
  return {
    name: store.name || '',
    branch: store.branch || '',
    files: store.status.files,
    diff: store.diff,
    lineCount: store.lineCount,
    selection: { files: new Set(store.selection.files), staged: store.selection.staged },
  };
});

const appStore = createStore(reducer, applyMiddleware(thunk));
const app = document.getElementById('app');
ReactDOM.render(
  <Provider store={appStore}>
    <AppContainer/>
  </Provider>,
  app,
);
