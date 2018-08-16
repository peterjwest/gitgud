import { app, BrowserWindow, Menu, shell, dialog, webContents } from 'electron';
import { ipcMain, Event } from 'electron';
import * as defaultMenu from 'electron-default-menu';
import * as nodegit from 'nodegit';

interface File {
  path: string;
  status: number;
}

interface WindowData {
  path: string;
  window: BrowserWindow;
  repo?: nodegit.Repository;
}

app.setName('Gitgud');

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const windowsData: { [path: string]: WindowData} = {};
const webContentsMap = new WeakMap<webContents, WindowData>();

app.on('ready', () => {
  createWindow(process.cwd());

  const menuTemplate = defaultMenu(app, shell);
  menuTemplate.splice(1, 0, {
    label: 'File',
    submenu: [
      {
        label: 'Open...',
        click: openRepo,
        accelerator: 'CmdOrCtrl+O',
      },
    ],
  });

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

ipcMain.on('stage', async (event: Event, file: File) => {
  const windowData = webContentsMap.get(event.sender);
  if (!windowData || !windowData.repo) {
    throw new Error('Repository not loaded');
  }
  const index = await windowData.repo.refreshIndex();

  if (file.status === nodegit.Status.STATUS.WT_DELETED) {
    await index.removeByPath(file.path);
  } else {
    await index.addByPath(file.path);
  }

  await index.write() as any;
  await index.writeTree();
  event.sender.send('status', { files: await getGitStatus(windowData.repo) });
});

ipcMain.on('unstage', async(event: Event, file: File) => {
  const windowData = webContentsMap.get(event.sender);
  if (!windowData || !windowData.repo) {
    throw new Error('Repository not loaded');
  }

  const commit = await windowData.repo.getHeadCommit();
  await nodegit.Reset.default(windowData.repo, commit as any, [file.path]);
  const index = await windowData.repo.refreshIndex();
  await index.writeTree();
  event.sender.send('status', { files: await getGitStatus(windowData.repo) });
});

function createWindow(path: string) {
  if (windowsData[path]) {
    windowsData[path].window.focus();
  } else {
    windowsData[path] = getWindow(path, removeWindow);
    webContentsMap.set(windowsData[path].window.webContents, windowsData[path]);
  }
}

function removeWindow(path: string) {
  delete windowsData[path];
}

function getWindow(path: string, windowClosed: (path: string) => void) {
  const window = new BrowserWindow({
    title: '',
    width: 800,
    height: 600,
  });

  const windowData: WindowData = {
    path: path,
    window: window,
    repo: undefined,
  };

  window.webContents.on('did-finish-load', () => {
    nodegit.Repository.open(path).then(async (repo) => {
      windowData.repo = repo;
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

  return windowData;
}

async function getGitStatus(repo: nodegit.Repository) {
  const files: File[] = [];
  await nodegit.Status.foreach(repo, (path: string, status: number) => {
    files.push({ path: path, status: status });
  });
  return files.filter((file) => file.status !== nodegit.Status.STATUS.IGNORED);
}

function openRepo() {
  dialog.showOpenDialog({ properties: ['openDirectory'] }, (folders) => {
    if (folders) {
      createWindow(folders[0]);
    }
  });
}
