import * as React from 'react';
import $ from 'classnames';
import { findIndex } from 'lodash';

import { Store, AppAction } from '../reducer';
import { connect, ActionProps } from '../connect';
import { parsePatch, LineDiff, LineBreak } from '../../util/git';
import { getMouseItemIndex, getRangeItems, ModifierKeys } from '../../util/util';

interface DiffViewStoreProps {
  lines: Array<LineDiff | LineBreak>;
  selectedLines: Set<string>;
}

interface DiffViewOwnProps {
  modifiers: ModifierKeys;
}
interface DiffViewState {
  dragSelection?: { start: number, end: number };
  lastSelected?: LineDiff | LineBreak;
}

function lineIdentifier(line: LineDiff) {
  return line.lineNumbers.join(',');
}

function isLineDiff(line: LineDiff | LineBreak): line is LineDiff {
  return line.type !== '.';
}

function lookupLineIndex(lines: Array<LineDiff | LineBreak>, target: LineDiff | LineBreak | undefined) {
  const index = target && isLineDiff(target) ? findIndex(lines, (line) => isLineDiff(line) && lineIdentifier(line) === lineIdentifier(target)) : -1;
  return index >= 0 ? index : undefined;
}

class DiffView extends React.Component<DiffViewStoreProps & ActionProps<AppAction> & DiffViewOwnProps, DiffViewState> {
  state: DiffViewState = {};
  element?: HTMLFormElement;

  toggleLine(line: LineDiff) {
    const identifier = lineIdentifier(line);
    const selectedLines = new Set(this.props.selectedLines);
    if (selectedLines.has(identifier)) {
      selectedLines.delete(identifier);
    } else {
      selectedLines.add(identifier);
    }

    this.props.dispatch({ type: 'UpdateSelectedLines', lines: Array.from(selectedLines) });
  }

  // TODO: Get this to return last item
  getLinesFromRange(range: { start: number, end: number }) {
    const selectedLines = getRangeItems(this.props.lines, range).filter(isLineDiff).map(lineIdentifier);
    const modifierActive = this.props.modifiers.Meta || this.props.modifiers.Control || this.props.modifiers.Shift;
    let lastSelected: LineDiff | LineBreak | undefined = this.props.lines[range.end];

    if (modifierActive) {
      const existing = new Set(this.props.selectedLines);

      if (selectedLines.length <= 1 && this.props.modifiers.Shift) {
        const shiftRange = {
          start: lookupLineIndex(this.props.lines, this.state.lastSelected) || range.start,
          end: range.end,
        };
        const shiftRangeLines = getRangeItems(this.props.lines, shiftRange).filter(isLineDiff).map(lineIdentifier);
        shiftRangeLines.forEach((line) => existing.add(line));
        lastSelected = this.props.lines[shiftRange.end];
      } else if (selectedLines.length === 1 && existing.has(selectedLines[0])) {
        existing.delete(selectedLines[0]);
        lastSelected = undefined;
      } else {
        selectedLines.forEach((line) => existing.add(line));
      }
      return { selection: Array.from(existing), lastSelected: lastSelected };
    }
    return { selection: selectedLines, lastSelected: lastSelected };
  }

  selectLines(range: { start: number, end: number }) {
    const { selection, lastSelected } = this.getLinesFromRange(range);
    this.props.dispatch({ type: 'UpdateSelectedLines', lines: selection });

    this.setState({ lastSelected: lastSelected });
  }

  startDrag(mousePosition: number) {
    if (this.element) {
      const index = getMouseItemIndex(this.element, mousePosition);
      this.setState({ dragSelection: { start: index, end: index }});
    }
  }

  moveDrag(mousePosition: number) {
    const selection = this.state.dragSelection;
    if (this.element && selection) {
      const end = getMouseItemIndex(this.element, mousePosition);
      this.setState({ dragSelection: { ...selection, end: end }});
    }
  }

  endDrag() {
    const selection = this.state.dragSelection;
    if (selection) {
      this.selectLines(selection);
      this.setState({ dragSelection: undefined });
    }
  }

  renderLine(line: LineDiff | LineBreak) {
    const draggedLines = this.state.dragSelection ? getRangeItems<LineDiff | LineBreak>(this.props.lines, this.state.dragSelection) : [];
    const draggedLineSet = new Set(draggedLines.filter(isLineDiff).map(lineIdentifier));
    const dragSelected = isLineDiff(line) && draggedLineSet.has(lineIdentifier(line));
    const selected = isLineDiff(line) && this.props.selectedLines.has(lineIdentifier(line));
    const modifier = this.props.modifiers.Meta || this.props.modifiers.Control || this.props.modifiers.Shift;

    if (!isLineDiff(line)) {
      return (
        <div className={'App_diffView_line App_diffView_line-ellipsis'}>
          <span className={'App_diffView_line_checkbox'}/>
          <span className={'App_diffView_line_number'} data-line-number={'...'}/>
          <span className={'App_diffView_line_number'} data-line-number={'...'}/>
        </div>
      );
    }

    return (
      <div className={$(
        'App_diffView_line',
        {
          'App_diffView_line-selected': selected,
          'App_diffView_line-drag': dragSelected || (selected && modifier),
          'App_diffView_line-addition': line.type === '+',
          'App_diffView_line-removal': line.type === '-',
        },
      )}>
        <span className={'App_diffView_line_checkbox'}>
          <input
            type="checkbox"
            name="selected[]"
            checked={selected}
            value={'TODO'}
            // Prevent activating the drag and drop
            onMouseDown={(event) => event.stopPropagation()}
            onChange={() => this.toggleLine(line)}
          />
        </span>
        <span className={'App_diffView_line_number'} data-line-number={line.type !== '+' ? line.lineNumbers[0] : ''}/>
        <span className={'App_diffView_line_number'} data-line-number={line.type !== '-' ? line.lineNumbers[1] : ''}/>
        <span className={'App_diffView_line_type'} data-line-number={line.type}/>
        <pre className={'App_diffView_line_text'}>{line.text}</pre>
      </div>
    );
  }

  render() {
    return (
      <div
        className={'App_diffView'}
        onMouseDown={(event) => this.startDrag(event.nativeEvent.clientY)}
        onMouseMove={(event) => this.moveDrag(event.nativeEvent.clientY)}
        onMouseUp={(event) => this.endDrag()}
      >
        <form
          className={'App_diffView_inner'}
          ref={(element) => this.element = element || undefined}
        >
          {this.props.lines.map((line, i) => this.renderLine(line))}
        </form>
      </div>
    );
  }
}

const DiffViewContainer: React.ComponentClass<DiffViewOwnProps> = connect(DiffView, (store: Store): DiffViewStoreProps => {
  return {
    lines: parsePatch(store.diff || '', store.lineCount),
    selectedLines: new Set(store.lineSelection.lines),
  };
});

export default DiffViewContainer;


