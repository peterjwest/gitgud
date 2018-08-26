import { last } from 'lodash';

export interface Hunk {
  index: number;
  lineNumbers: string[];
}

export interface LineDiff {
  type: '+' | '-' | ' ';
  text: string;
  lineNumbers: [number, number];
}

export interface LineBreak {
  type: '.';
}

// Converts a string type into a `Keys` type by matching, falling back to a default value
function lookupKey<Keys extends string>(value: string, keys: Keys[], defaultKey: Keys) {
  return keys.find((key) => key === value) || defaultKey;
}

// Takes a list of lines from a Git patch diff and returns a list of hunks with line indexes
function parsePatchHunks(lines: string[]): Hunk[] {
  return lines.map((line, index) => {
    const match = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
    const lineNumbers = match ? match.slice(1, 5) : undefined;
    return { index: index, lineNumbers: lineNumbers };
  })
  .filter((hunk): hunk is Hunk => Boolean(hunk.lineNumbers));
}

// Parses a Git patch diff and returns diff information per line, per hunk
export function parsePatch(patch: string, lineCount: number) {
  const lines = patch.split('\n');
  const hunks = parsePatchHunks(lines)
  .map((hunk, i, indexes) => {
    const rangeStart = hunk.index + 1;
    const rangeEnd = indexes[i + 1] ? indexes[i + 1].index : lines.length - 1;
    const lineNumbers = [Number(hunk.lineNumbers[0]) - 1, Number(hunk.lineNumbers[2]) - 1];

    return lines.slice(rangeStart, rangeEnd).map((line): LineDiff => {
      const type = lookupKey(line[0], ['+', '-', ' '], ' ');
      if (type !== '+') {
        lineNumbers[0]++;
      }
      if (type !== '-') {
        lineNumbers[1]++;
      }
      return { type: type, text: line.slice(1), lineNumbers: [lineNumbers[0], lineNumbers[1]] };
    });
  });
  return flattenHunks(hunks, lineCount);
}

// Flattens hunks into lines, adding LineBreak entries between them
function flattenHunks(hunks: LineDiff[][], lineCount: number) {
  const finalLine = last(hunks) && last(last(hunks));
  return hunks.reduce((hunk: Array<LineDiff | LineBreak>, nextHunk) => {
    return hunk
    .concat(nextHunk[0].lineNumbers[1] > 1 ? [{ type: '.' }] : [])
    .concat(nextHunk);
  }, [])
  .concat(finalLine && finalLine.lineNumbers[1] < lineCount ? [{ type: '.' }] : []);
}
