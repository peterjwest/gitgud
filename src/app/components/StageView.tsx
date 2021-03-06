import * as React from 'react';
import { ipcRenderer } from 'electron';
import $ from 'classnames';
import { findIndex } from 'lodash';

import { Store, FileStatus, AppAction } from '../reducer';
import { connect, ActionProps } from '../connect';
import { getMouseItemIndex, getRangeItems, IS_STAGED, ModifierKeys } from '../../util/util';

interface StageViewStoreProps {
  files: {
    unstaged: FileStatus[];
    staged: FileStatus[];
  };
  selection: {
    files: Set<string>;
    staged: boolean;
  };
}

interface StageViewOwnProps {
  modifiers: ModifierKeys;
}

interface StageViewState {
  dragSelection?: {
    range: {start: number, end: number};
    staged: boolean;
    transfer: boolean;
  };
  lastSelected?: FileStatus;
}

function lookupFileIndex(files: FileStatus[], target: FileStatus | undefined) {
  const index = target ? findIndex(files, (file) => Boolean(file.path === target.path)) : -1;
  return index >= 0 ? index : undefined;
}

class StageView extends React.Component<StageViewStoreProps & ActionProps<AppAction> & StageViewOwnProps, StageViewState> {
  unstagedElement?: HTMLUListElement;
  stagedElement?: HTMLUListElement;
  state: StageViewState = {};

  selectDiffFile(file: FileStatus, staged: boolean) {
    ipcRenderer.send('diff', file, staged);
  }

  getFilesFromRange(files: FileStatus[], range: { start: number, end: number }, staged: boolean, additiveOnly = false) {
    const selectedFiles = getRangeItems(files, range).map((file) => file.path);
    const modifierActive = this.props.modifiers.Meta || this.props.modifiers.Control || this.props.modifiers.Shift;
    let lastSelected: FileStatus | undefined = files[range.end];
    if (this.props.selection.staged === staged && (modifierActive || additiveOnly)) {
      const existing = new Set(this.props.selection.files);

      if (selectedFiles.length === 1 && this.props.modifiers.Shift) {
        const shiftRange = {
          start: lookupFileIndex(files, this.state.lastSelected) || range.start,
          end: range.end,
        };
        const shiftRangeFiles = getRangeItems(files, shiftRange).map((file) => file.path);
        shiftRangeFiles.forEach((file) => existing.add(file));
        lastSelected = files[shiftRange.end];
      } else if (selectedFiles.length === 1 && existing.has(selectedFiles[0]) && !additiveOnly) {
        existing.delete(selectedFiles[0]);
        lastSelected = undefined;
      } else {
        selectedFiles.forEach((file) => existing.add(file));
      }
      return { selection: Array.from(existing), lastSelected: lastSelected };
    }
    return { selection: selectedFiles, lastSelected: lastSelected };
  }

  stageFiles(files: FileStatus[], toStage: boolean) {
    ipcRenderer.send(toStage ? 'stage' : 'unstage', files);
  }

  stageSelection(toStage: boolean) {
    if (this.hasSelection(!toStage)) {
      const selection = this.props.selection;
      const files = this.props.files[selection.staged ? 'staged' : 'unstaged'];
      const selectedFiles = files.filter((file) => selection.files.has(file.path));
      this.stageFiles(selectedFiles, toStage);
      this.props.dispatch({ type: 'UpdateSelectedFiles', files: Array.from(selection.files), staged: !selection.staged });
    }
  }

  hasSelection(isStaged: boolean) {
    return this.props.selection.staged === isStaged && this.props.selection.files.size > 0;
  }

  selectFiles(files: FileStatus[], range: { start: number, end: number }, staged: boolean) {
    const { selection, lastSelected } = this.getFilesFromRange(files, range, staged);
    this.props.dispatch({ type: 'UpdateSelectedFiles', files: selection, staged: staged });

    this.setState({ lastSelected: lastSelected });
    if (lastSelected) {
      this.selectDiffFile(lastSelected, staged);
    }
  }

  toggleFile(file: FileStatus, staged: boolean) {
    const selectedFiles = new Set(this.props.selection.files);
    if (selectedFiles.has(file.path)) {
      selectedFiles.delete(file.path);
    } else {
      selectedFiles.add(file.path);
    }

    this.props.dispatch({ type: 'UpdateSelectedFiles', files: Array.from(selectedFiles), staged: staged });
    this.setState({ lastSelected: file });
    this.selectDiffFile(file, staged);
  }

  startDrag(mousePosition: number, element: HTMLElement | undefined, staged: boolean) {
    if (element) {
      const index = getMouseItemIndex(element, mousePosition);
      this.setState({ dragSelection: { range: { start: index, end: index }, staged: staged, transfer: false }});
    }
  }

  moveDrag(mousePosition: number, element: HTMLElement | undefined, staged: boolean) {
    const selection = this.state.dragSelection;
    if (element && selection) {
      const end = staged === selection.staged ? getMouseItemIndex(element, mousePosition) : selection.range.start;
      this.setState({ dragSelection: {
        range: { ...selection.range, end: end },
        staged: selection.staged,
        transfer: staged !== selection.staged,
      }});
    }
  }

  endDrag(toStage: boolean) {
    const selection = this.state.dragSelection;
    if (selection) {
      const files = this.props.files[selection.staged ? 'staged' : 'unstaged'];
      if (toStage === selection.staged) {
        this.selectFiles(files, selection.range, toStage);
      } else {
        // TODO optimise set/array conversion
        const transferRange = { start: selection.range.start, end: selection.range.start };
        const selectedFilesSet = new Set(this.getFilesFromRange(files, transferRange, selection.staged, true).selection);
        const selectedFiles = files.filter((file) => selectedFilesSet.has(file.path));
        this.stageFiles(selectedFiles, toStage);
        this.props.dispatch({ type: 'UpdateSelectedFiles', files: Array.from(selectedFilesSet), staged: !selection.staged });
      }
      this.setState({ dragSelection: undefined });
    }
  }

  renderFileStatus(file: FileStatus, draggedFiles: Set<string>, staged: boolean, isTransfer: boolean) {
    const dragSelected = draggedFiles.has(file.path);
    const selected = this.props.selection.staged === staged && this.props.selection.files.has(file.path);
    const modifier = this.props.modifiers.Meta || this.props.modifiers.Control || this.props.modifiers.Shift;
    return (
      <li
        className={$(
          'App_stageView_pane_file',
          {
            'App_stageView_pane_file-selected': selected,
            'App_stageView_pane_file-drag': dragSelected || (selected && modifier),
            'App_stageView_pane_file-transfer': (dragSelected || selected) && isTransfer,
          },
        )}
      >
        <div className={'App_stageView_pane_file_select'}>
          <input
            type="checkbox"
            name="selected[]"
            checked={selected}
            value={file.path}
            // Prevent activating the drag and drop
            onMouseDown={(event) => event.stopPropagation()}
            onChange={() => this.toggleFile(file, staged)}
          /> {file.path}
        </div>
      </li>
    );
  }

  renderStagePane(staged: boolean) {
    const files = this.props.files[staged ? 'staged' : 'unstaged'];
    const elementName = staged ? 'stagedElement' : 'unstagedElement';
    const dragSelection = this.state.dragSelection;
    const draggedFiles = dragSelection && dragSelection.staged === staged ? getRangeItems(files, dragSelection.range) : [];
    const draggedFileSet = new Set(draggedFiles.map((file) => file.path));
    const isTransfer = Boolean(dragSelection && dragSelection.transfer);
    return (
      <form
        className={`App_stageView_pane App_stageView_pane-${staged ? 'staged' : 'unstaged'}`}
        onMouseDown={(event) => this.startDrag(event.nativeEvent.clientY, this[elementName], staged)}
        onMouseMove={(event) => this.moveDrag(event.nativeEvent.clientY, this[elementName], staged)}
        onMouseUp={(event) => this.endDrag(staged)}
        onSubmit={(event) => {
          event.preventDefault();
          this.stageSelection(!staged);
        }}
      >
        <div className={'App_stageView_pane_titlebar'}>
          <h2 className={'App_stageView_pane_titlebar_title'}>{staged ? 'Staged' : 'Unstaged'} changes</h2>
          <button
            type="submit"
            className={'App_stageView_pane_titlebar_action'}
            disabled={!this.hasSelection(staged)}
            // Prevent activating the drag and drop
            onMouseDown={(event) => event.stopPropagation()}
          >
            {staged ? 'Unstage' : 'Stage'}
          </button>
        </div>
        <ul className={'App_stageView_pane_content'} ref={(element) => this[elementName] = element || undefined}>
          {files.map((file) => this.renderFileStatus(file, draggedFileSet, staged, isTransfer))}
        </ul>
      </form>
    );
  }

  render() {
    return (
      <div className={'App_stageView'}>
        {this.renderStagePane(false)}
        {this.renderStagePane(true)}
      </div>
    );
  }
}

const StageViewContainer: React.ComponentClass<StageViewOwnProps> = connect(StageView, (store: Store): StageViewStoreProps => {
  return {
    files: {
      unstaged: store.status.files.filter((file) => file.status & ~IS_STAGED),
      staged: store.status.files.filter((file) => file.status & IS_STAGED),
    },
    selection: { files: new Set(store.fileSelection.files), staged: store.fileSelection.staged },
  };
});

export default StageViewContainer;
