import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as nodegit from 'nodegit';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import { Event } from 'electron';

import reducer, { Store, FileStatus, AppAction } from './reducer';
import { connect, ActionProps } from './connect';

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
}

interface AppProps extends AppStoreProps, ActionProps<AppAction> {}
interface AppState {}

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    ipcRenderer.on('init', (event: Event, data: { path: string, branch: string }) => {
      this.props.dispatch({ type: 'UpdateRepoAction', name: path.basename(data.path), branch: data.branch });
    });

    ipcRenderer.on('status', (event: Event, data: { files: FileStatus[] }) => {
      this.props.dispatch({ type: 'UpdateStatusAction', files: data.files });
    });

    ipcRenderer.on('diff', (event: Event, data: { diff: string}) => {
      this.props.dispatch({ type: 'UpdateSelectedFile', diff: data.diff });
    });
  }

  componentWillReceiveProps(nextProps: AppProps) {
    if (nextProps.name !== this.props.name || nextProps.branch !== this.props.branch) {
      document.title = nextProps.name ? `${nextProps.name} (${nextProps.branch || 'Branch does not exist yet'})` : 'Gitgud';
    }
  }

  updateStatus() {
    ipcRenderer.send('status');
  }

  stageFile(file: FileStatus) {
    ipcRenderer.send('stage', file);
  }

  unstageFile(file: FileStatus) {
    ipcRenderer.send('unstage', file);
  }

  fileDiff(file: FileStatus, staged: boolean) {
    ipcRenderer.send('diff', file, staged);
  }

  renderFileStatus(file: FileStatus, fileAction: () => void, selectFile: () => void) {
    return (
      <li>
        <label><input type="radio" name="selected" onClick={selectFile} value={file.path}/> {file.path}</label>
        <button onClick={fileAction}>Stage/Unstage</button>
      </li>
    );
  }

  render() {
    const unstagedFiles = this.props.files.filter((file) => file.status & ~IS_STAGED);
    const stagedFiles = this.props.files.filter((file) => file.status & IS_STAGED);

    return (
      <div>
        <button onClick={() => this.updateStatus()}>Refresh</button>
        <h2>Unstaged</h2>
        <ul>
          {unstagedFiles.map((file) => this.renderFileStatus(file, () => this.stageFile(file), () => this.fileDiff(file, false)))}
        </ul>
        <h2>Staged</h2>
        <ul>
          {stagedFiles.map((file) => this.renderFileStatus(file, () => this.unstageFile(file), () => this.fileDiff(file, true)))}
        </ul>
        <pre>{this.props.diff}</pre>
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
