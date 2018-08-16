import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as nodegit from 'nodegit';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

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
  files: FileStatus[];
}

interface AppProps extends AppStoreProps, ActionProps<AppAction> {}
interface AppState {}

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    ipcRenderer.on('init', (event: any, data: {path: string, branch: string}) => {
      document.title = `${path.basename(data.path)} (${data.branch || 'Branch does not exist yet'})`;
    });

    ipcRenderer.on('status', (event: any, data: { files: FileStatus[] }) => {
      this.props.dispatch({ type: 'UPDATE_STATUS', files: data.files });
    });
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
