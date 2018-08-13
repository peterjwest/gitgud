const { ipcRenderer } = require('electron');
const path = require('path');
const nodegit = require('nodegit');

const status = nodegit.Status.STATUS;

const IS_STAGED = (
  status.INDEX_NEW |
  status.INDEX_MODIFIED |
  status.INDEX_DELETED |
  status.INDEX_RENAMED |
  status.INDEX_TYPECHANGE
);

ipcRenderer.on('init', (event, data) => {
  document.title = `${path.basename(data.path)} (${data.branch || 'Branch does not exist yet'})`;
});

const unstagedContainer = document.getElementById('unstaged');
const stagedContainer = document.getElementById('staged');

function stageFile(file) {
  ipcRenderer.send('stage', file);
}

function unstageFile(file) {
  ipcRenderer.send('unstage', file);
}

ipcRenderer.on('status', (event, data) => {
  const unstagedFiles = data.files.filter((file) => file.status & ~IS_STAGED);
  const stagedFiles = data.files.filter((file) => file.status & IS_STAGED);

  unstagedContainer.innerHTML = '';
  stagedContainer.innerHTML = '';

  unstagedFiles.forEach((file) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = file.path;
    button.addEventListener('click', () => stageFile(file));
    item.appendChild(button);
    unstagedContainer.appendChild(item);
  });

  stagedFiles.forEach((file) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = file.path;
    button.addEventListener('click', () => unstageFile(file));
    item.appendChild(button);
    stagedContainer.appendChild(item);
  });
});
