import * as React from 'react';
import $ from 'classnames';

import { Store, AppAction } from '../reducer';
import { connect, ActionProps } from '../connect';
import { parsePatch, LineDiff, LineBreak } from '../../util/git';
import { ModifierKeys } from '../../util/util';

interface DiffViewStoreProps {
  diff?: string;
  lineCount: number;
}

interface DiffViewOwnProps {
  modifiers: ModifierKeys;
}
interface DiffViewState {}

class DiffView extends React.Component<DiffViewStoreProps & ActionProps<AppAction> & DiffViewOwnProps, DiffViewState> {
  state: DiffViewState = {};

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
      <div className={'App_diffView'}>
        <div className={'App_diffView_inner'}>
          {lines.map((line) => this.renderLine(line))}
        </div>
      </div>
    );
  }
}

const DiffViewContainer: React.ComponentClass<DiffViewOwnProps> = connect(DiffView, (store: Store): DiffViewStoreProps => {
  return {
    diff: store.diff,
    lineCount: store.lineCount,
  };
});

export default DiffViewContainer;
