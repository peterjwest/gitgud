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
import { findIndex } from 'lodash';

import reducer, { Store, FileStatus, AppAction } from './reducer';
import { connect, ActionProps } from './connect';
import { parsePatch, LineDiff, LineBreak } from '../git';

// Finds the index of a vertical list item currently occupied by the mouse
// Assumes that all list items are the same height
function getMouseItemIndex(container: HTMLElement, mousePosition: number) {
  const childCount = container.children.length;
  if (childCount === 0) {
    return -1;
  }

  const fileHeight = container.children[0].getBoundingClientRect().height;
  const containerPosition = container.getBoundingClientRect();

  if (mousePosition < containerPosition.top) {
    return -1;
  }
  if (mousePosition > containerPosition.bottom) {
    return childCount;
  }

  const index = Math.floor((mousePosition - containerPosition.top + container.scrollTop) / fileHeight);
  return Math.max(Math.min(index, childCount), -1);
}

// Find all items within two index in an array (indexes can be outside the array range)
function getRangeItems<Item>(items: Item[], range: { start: number, end: number }) {
  if (range.start < 0 && range.end < 0) {
    return [];
  }
  if (range.start >= items.length && range.end >= items.length) {
    return [];
  }
  if (range.start < range.end) {
    return items.slice(Math.max(0, range.start), range.end + 1);
  } else {
    return items.slice(Math.max(0, range.end), range.start + 1);
  }
}

// Get from an array by index (index is bounded to nearest in the array)
function getBoundedItem<Item>(items: Item[], index: number) {
  return items[Math.max(Math.min(index, items.length - 1), 0)];
}

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
  files: {
    unstaged: FileStatus[];
    staged: FileStatus[];
  };
  diff?: string;
  lineCount: number;
  selection: {
    files: Set<string>;
    staged: boolean;
  };
}

interface AppProps extends AppStoreProps, ActionProps<AppAction> {}
interface AppState {
  dragSelection?: {
    range: {start: number, end: number};
    staged: boolean;
  };
  lastSelected?: string;
  modifiers: ModifierKeys;
}

interface ModifierKeys {
  Meta: boolean;
  Shift: boolean;
  Control: boolean;
  Alt: boolean;
}

class App extends React.Component<AppProps, AppState> {
  unstagedElement?: HTMLUListElement;
  stagedElement?: HTMLUListElement;
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

  toggleStageFile(file: FileStatus, stage: boolean) {
    ipcRenderer.send(stage ? 'stage' : 'unstage', file);
  }

  fileDiff(file: FileStatus, staged: boolean) {
    ipcRenderer.send('diff', file, staged);
  }

  selectFiles(files: FileStatus[], range: { start: number, end: number }, staged: boolean) {
    let selectedFiles = getRangeItems(files, range).map((file) => file.path);
    if (this.props.selection.staged === staged && (this.state.modifiers.Meta || this.state.modifiers.Control || this.state.modifiers.Shift)) {
      const existing = new Set(this.props.selection.files);

      if (selectedFiles.length === 1 && this.state.modifiers.Shift) {
        const shiftRange = {
          start: this.state.lastSelected ? findIndex(files, (file) => file.path === this.state.lastSelected) : range.start,
          end: range.end,
        };
        const shiftRangeFiles = getRangeItems(files, shiftRange).map((file) => file.path);
        shiftRangeFiles.forEach((file) => existing.add(file));
      } else if (selectedFiles.length === 1 && existing.has(selectedFiles[0])) {
        existing.delete(selectedFiles[0]);
      } else {
        selectedFiles.forEach((file) => existing.add(file));
      }
      selectedFiles = Array.from(existing);
    }
    this.props.dispatch({ type: 'UpdateSelectedFiles', files: selectedFiles, staged: staged });
    const lastSelected = getBoundedItem(files, range.end);
    this.setState({ lastSelected: lastSelected ? lastSelected.path : undefined });
    this.fileDiff(lastSelected, staged);
  }

  toggleFile(file: FileStatus, staged: boolean) {
    let selectedFiles: string[];
    if (this.props.selection.staged === staged) {
      const existing = new Set(this.props.selection.files);
      if (existing.has(file.path)) {
        existing.delete(file.path);
      } else {
        existing.add(file.path);
      }
      selectedFiles = Array.from(existing);
    } else {
      selectedFiles = [file.path];
    }

    this.props.dispatch({ type: 'UpdateSelectedFiles', files: selectedFiles, staged: staged });
    this.setState({ lastSelected: file.path });
    this.fileDiff(file, staged);
  }

  startDrag(mousePosition: number, element: HTMLElement | undefined, staged: boolean) {
    if (element) {
      const index = getMouseItemIndex(element, mousePosition);
      this.setState({ dragSelection: { range: { start: index, end: index }, staged: staged }});
    }
  }

  moveDrag(mousePosition: number, element: HTMLElement | undefined, staged: boolean) {
    const selection = this.state.dragSelection;
    if (element && selection) {
      const end = staged === selection.staged ? getMouseItemIndex(element, mousePosition) : selection.range.start;
      this.setState({ dragSelection: { range: { ...selection.range, end: end }, staged: selection.staged }});
    }
  }

  endDrag(mousePosition: number, element: HTMLElement | undefined, staged: boolean, files: FileStatus[]) {
    const selection = this.state.dragSelection;
    if (element && selection) {
      if (staged === selection.staged) {
        const end = getMouseItemIndex(element, mousePosition);
        this.selectFiles(files, { ...selection.range, end: end }, staged);
      }
      this.setState({ dragSelection: undefined });
    }
  }

  renderStagePane(staged: boolean, files: FileStatus[]) {
    const elementName = staged ? 'stagedElement' : 'unstagedElement';
    const dragSelection = this.state.dragSelection;
    const draggedFiles = dragSelection && dragSelection.staged === staged ? getRangeItems(files, dragSelection.range) : [];
    const draggedFileSet = new Set(draggedFiles.map((file) => file.path));
    return (
      <div
        className={`App_stageView_pane App_stageView_pane-${staged ? 'staged' : 'unstaged'}`}
        onMouseDown={(event) => this.startDrag(event.nativeEvent.clientY, this[elementName], staged)}
        onMouseMove={(event) => this.moveDrag(event.nativeEvent.clientY, this[elementName], staged)}
        onMouseUp={(event) => this.endDrag(event.nativeEvent.clientY, this[elementName], staged, files)}
      >
        <h2 className={'App_stageView_pane_title'}>{staged ? 'Staged' : 'Unstaged'} changes</h2>
        <ul
          className={'App_stageView_pane_content'}
          ref={(element) => this[elementName] = element || undefined}
        >
          {files.map((file) => this.renderFileStatus(file, draggedFileSet, staged))}
        </ul>
      </div>
    );
  }

  renderFileStatus(file: FileStatus, draggedFiles: Set<string>, staged: boolean) {
    const dragSelected = draggedFiles.has(file.path);
    const selected = this.props.selection.staged === staged && this.props.selection.files.has(file.path);
    const modifier = this.state.modifiers.Meta || this.state.modifiers.Control || this.state.modifiers.Shift;
    return (
      <li
        className={$(
          'App_stageView_pane_file',
          {
            ['App_stageView_pane_file-selected']: selected,
            ['App_stageView_pane_file-drag']: dragSelected || (selected && modifier),
          },
        )}
      >
        <div className={'App_stageView_pane_file_select'}>
          <input
            type="checkbox"
            name="selected[]"
            checked={selected}
            value={file.path}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={() => this.toggleFile(file, staged)}
          /> {file.path}
        </div>
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
    const lines = parsePatch(this.props.diff || '', this.props.lineCount);

    return (
      <div className={'App'}>
        <div className={'App_titlebar'}>
          <h1 className={'App_titlebar_title'}>
            {this.getTitle(this.props)} <button className={'App_titlebar_refresh'} onClick={() => this.updateStatus()}>Refresh</button>
          </h1>
        </div>
        <div className={'App_stageView'}>
          {this.renderStagePane(false, this.props.files.unstaged)}
          {this.renderStagePane(true, this.props.files.staged)}
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
    files: {
      unstaged: store.status.files.filter((file) => file.status & ~IS_STAGED),
      staged: store.status.files.filter((file) => file.status & IS_STAGED),
    },
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
