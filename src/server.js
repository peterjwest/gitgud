const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { ipcMain } = require('electron');
const defaultMenu = require('electron-default-menu');
const nodegit = require('nodegit');

app.setName('Gitgud');

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const windows = {};

app.on('ready', () => {
  createWindow(process.cwd());

  const menuTemplate = defaultMenu(app, shell);
  menuTemplate.splice(1, 0, {
    label: "File",
    submenu: [
      {
        label: "Open...",
        click: openRepo,
        accelerator: 'CmdOrCtrl+O',
      },
    ],
  });

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

ipcMain.on('stage', async (event, file) => {
  const webContents = event.sender;
  const index = await webContents.repo.refreshIndex();

  if (file.status === nodegit.Status.STATUS.WT_DELETED) {
    await index.removeByPath(file.path);
  } else {
    await index.addByPath(file.path);
  }

  await index.write();
  await index.writeTree();
  webContents.send('status', { files: await getGitStatus(webContents.repo) });
});

ipcMain.on('unstage', async(event, file) => {
  const webContents = event.sender;
  const commit = await webContents.repo.getHeadCommit();
  await nodegit.Reset.default(webContents.repo, commit, [file.path]);
  const index = await webContents.repo.refreshIndex();
  await index.writeTree();
  webContents.send('status', { files: await getGitStatus(webContents.repo) });
});

function createWindow(path) {
  if (windows[path]) {
    windows[path].focus();
  } else {
    windows[path] = getWindow(path, removeWindow);
  }
}

function removeWindow(path) {
  delete windows[path];
}

function getWindow(path, windowClosed) {
  const window = new BrowserWindow({
    title: '',
    width: 800,
    height: 600
  });

  window.webContents.on('did-finish-load', () => {
    nodegit.Repository.open(path).then(async (repo) => {
      window.webContents.repo = repo;
      const currentBranch = await repo.getCurrentBranch();
      window.webContents.send('init', { path: path, branch: currentBranch.shorthand() });
      window.webContents.send('status', { files: await getGitStatus(repo) });
    })
    .catch((error) => {
      if (error.errno === nodegit.Error.CODE.EUNBORNBRANCH) {
        window.webContents.send('init', { path: path, branch: undefined });
      } else {
        dialog.showMessageBox(
          window,
          { type: 'error', message: `${path} is not a valid Git repository` },
          () => {
            window.close();
            windowClosed(path);
          },
        );
      }
    });
  });

  window.loadFile('app/index.html');

  window.on('closed', () => windowClosed(path));

  return window;
}

async function getGitStatus(repo) {
  const files = [];
  await nodegit.Status.foreach(repo, (path, status) => {
    files.push({path: path, status: status});
  })
  return files.filter((file) => file.status !== nodegit.Status.STATUS.IGNORED);
}

function openRepo() {
  dialog.showOpenDialog({properties: ['openDirectory']}, (folders) => {
    if (folders) {
      createWindow(folders[0]);
    }
  });
}
