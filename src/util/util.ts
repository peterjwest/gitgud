import * as nodegit from 'nodegit';

export interface ModifierKeys {
  Meta: boolean;
  Shift: boolean;
  Control: boolean;
  Alt: boolean;
}

export const IS_STAGED = (
  nodegit.Status.STATUS.INDEX_NEW |
  nodegit.Status.STATUS.INDEX_MODIFIED |
  nodegit.Status.STATUS.INDEX_DELETED |
  nodegit.Status.STATUS.INDEX_RENAMED |
  nodegit.Status.STATUS.INDEX_TYPECHANGE
);

// Finds the index of a vertical list item currently occupied by the mouse
// Assumes that all list items are the same height
export function getMouseItemIndex(container: HTMLElement, mousePosition: number) {
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
export function getRangeItems<Item>(items: Item[], range: { start: number, end: number }) {
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
export function getBoundedItem<Item>(items: Item[], index: number) {
  return items[Math.max(Math.min(index, items.length - 1), 0)];
}
