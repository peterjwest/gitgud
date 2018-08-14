import { ipcRenderer } from 'electron';
import * as path from 'path';
import * as nodegit from 'nodegit';

interface File {
  path: string;
  status: number;
}

const IS_STAGED = (
  nodegit.Status.STATUS.INDEX_NEW |
  nodegit.Status.STATUS.INDEX_MODIFIED |
  nodegit.Status.STATUS.INDEX_DELETED |
  nodegit.Status.STATUS.INDEX_RENAMED |
  nodegit.Status.STATUS.INDEX_TYPECHANGE
);

ipcRenderer.on('init', (event: any, data: {path: string, branch: string}) => {
  document.title = `${path.basename(data.path)} (${data.branch || 'Branch does not exist yet'})`;
});

const unstagedContainer: HTMLElement = <HTMLElement> document.getElementById('unstaged');
const stagedContainer: HTMLElement = <HTMLElement> document.getElementById('staged');

function stageFile(file: File) {
  ipcRenderer.send('stage', file);
}

function unstageFile(file: File) {
  ipcRenderer.send('unstage', file);
}

ipcRenderer.on('status', (event: any, data: { files: File[] }) => {
  const unstagedFiles = data.files.filter((file) => file.status & ~IS_STAGED);
  const stagedFiles = data.files.filter((file) => file.status & IS_STAGED);

  unstagedContainer.innerHTML = '';
  stagedContainer.innerHTML = '';

  unstagedFiles.forEach((file) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = file.path;
    button.addEventListener('click', () => stageFile(file));
    item.appendChild(button);
    unstagedContainer.appendChild(item);
  });

  stagedFiles.forEach((file) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = file.path;
    button.addEventListener('click', () => unstageFile(file));
    item.appendChild(button);
    stagedContainer.appendChild(item);
  });
});
