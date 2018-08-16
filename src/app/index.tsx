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
}

interface AppProps extends AppStoreProps, ActionProps<AppAction> {}
interface AppState {}

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    ipcRenderer.on('init', (event: Event, data: {path: string, branch: string}) => {
      this.props.dispatch({ type: 'UPDATE_REPO', name: path.basename(data.path), branch: data.branch });
    });

    ipcRenderer.on('status', (event: Event, data: { files: FileStatus[] }) => {
      this.props.dispatch({ type: 'UPDATE_STATUS', files: data.files });
    });
  }

  componentWillReceiveProps(nextProps: AppProps) {
    if (nextProps.name !== this.props.name || nextProps.branch !== this.props.branch) {
      document.title = nextProps.name ? `${nextProps.name} (${nextProps.branch || 'Branch does not exist yet'})` : 'Gitgud';
    }
  }

  stageFile(file: FileStatus) {
    ipcRenderer.send('stage', file);
  }

  unstageFile(file: FileStatus) {
    ipcRenderer.send('unstage', file);
  }

  renderFileStatus(file: FileStatus, onClick: () => void) {
    return (
      <li><button onClick={onClick}>{file.path}</button></li>
    );
  }

  render() {
    const unstagedFiles = this.props.files.filter((file) => file.status & ~IS_STAGED);
    const stagedFiles = this.props.files.filter((file) => file.status & IS_STAGED);

    return (
      <div>
        <h2>Unstaged</h2>
        <ul>
          {unstagedFiles.map((file) => this.renderFileStatus(file, () => this.stageFile(file)))}
        </ul>
        <h2>Staged</h2>
        <ul>
          {stagedFiles.map((file) => this.renderFileStatus(file, () => this.unstageFile(file)))}
        </ul>
      </div>
    );
  }
}

const AppContainer = connect(App, (store: Store): AppStoreProps => {
  return {
    name: store.name || '',
    branch: store.branch || '',
    files: store.status.files,
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
