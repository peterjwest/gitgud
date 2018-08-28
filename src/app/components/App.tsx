import * as React from 'react';
import { ipcRenderer } from 'electron';
import * as path from 'path';
import { Event } from 'electron';
import $ from 'classnames';

import { Store, FileStatus, AppAction } from '../reducer';
import { connect, ActionProps } from '../connect';
import { parsePatch, LineDiff, LineBreak } from '../../util/git';
import { ModifierKeys } from '../../util/util';
import StageView from './StageView';

interface AppStoreProps {
  name: string;
  branch: string;
  diff?: string;
  lineCount: number;
}

interface AppProps extends AppStoreProps, ActionProps<AppAction> {}
interface AppState {
  modifiers: ModifierKeys;
}

class App extends React.Component<AppProps, AppState> {
  state: AppState = {
    modifiers: {
      Meta: false,
      Shift: false,
      Control: false,
      Alt: false,
    },
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
      if (this.state.modifiers.hasOwnProperty(event.key)) {
        const key = event.key as keyof ModifierKeys;
        if (!this.state.modifiers[key]) {
          this.setState({ modifiers: { ...this.state.modifiers, [key]: true }});
        }
      }
    }, true);

    window.addEventListener('keyup', (event) => {
      if (this.state.modifiers.hasOwnProperty(event.key)) {
        const key = event.key as keyof ModifierKeys;
        if (this.state.modifiers[key]) {
          this.setState({ modifiers: { ...this.state.modifiers, [key]: false }});
        }
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

  selectDiffFile(file: FileStatus, staged: boolean) {
    ipcRenderer.send('diff', file, staged);
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
    const lines = parsePatch(this.props.diff || '', this.props.lineCount);

    return (
      <div className={'App'}>
        <div className={'App_titlebar'}>
          <h1 className={'App_titlebar_title'}>
            {this.getTitle(this.props)} <button className={'App_titlebar_refresh'} onClick={() => this.updateStatus()}>Refresh</button>
          </h1>
        </div>
        <StageView modifiers={this.state.modifiers} selectDiffFile={this.selectDiffFile.bind(this)}/>
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
    diff: store.diff,
    lineCount: store.lineCount,
  };
});

export default AppContainer;
