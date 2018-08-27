import { app, BrowserWindow, Menu, shell, dialog, webContents } from 'electron';
import { ipcMain, Event } from 'electron';
import * as defaultMenu from 'electron-default-menu';
import * as nodegit from 'nodegit';
import { exec } from 'child_process';
import * as path from 'path';

function emptyTreeId() {
  return '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
}

interface File {
  path: string;
  status: number;
}

interface WindowData {
  path: string;
  window: BrowserWindow;
  repo?: nodegit.Repository;
}

const repoPaths = process.argv.slice(2);

app.setName('Gitgud');

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const windowsData: { [path: string]: WindowData} = {};
const webContentsMap = new WeakMap<webContents, WindowData>();

app.on('ready', () => {
  if (repoPaths.length > 0) {
    repoPaths.forEach((repoPath) => createWindow(path.resolve(repoPath)));
  }
  else {
    createWindow(process.cwd());
  }

  const menuTemplate = defaultMenu(app, shell);
  menuTemplate.splice(1, 0, {
    label: 'File',
    submenu: [
      {
        label: 'Open...',
        click: chooseRepo,
        accelerator: 'CmdOrCtrl+O',
      },
    ],
  });

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

const untrackedFlags = (
  nodegit.Diff.OPTION.SHOW_UNTRACKED_CONTENT |
  nodegit.Diff.OPTION.INCLUDE_UNTRACKED |
  nodegit.Diff.OPTION.RECURSE_UNTRACKED_DIRS
);

ipcMain.on('diff', async (event: Event, file: File, staged: boolean) => {
  const windowData = webContentsMap.get(event.sender);
  if (!windowData || !windowData.repo) {
    throw new Error('Repository not loaded');
  }
  const lineCount = await countFileLines(path.join(windowData.path, file.path)).catch(() => -1);
  const diff = await getFileDiff(windowData.repo, file, staged);
  event.sender.send('diff', { diff: diff, lineCount: lineCount });
});

ipcMain.on('status', async (event: Event) => {
  const windowData = webContentsMap.get(event.sender);
  if (!windowData || !windowData.repo) {
    throw new Error('Repository not loaded');
  }
  event.sender.send('status', { files: await getGitStatus(windowData.repo) });
});

ipcMain.on('stage', async (event: Event, files: File[]) => {
  const windowData = webContentsMap.get(event.sender);
  if (!windowData || !windowData.repo) {
    throw new Error('Repository not loaded');
  }
  const index = await windowData.repo.refreshIndex();

  for (const file of files) {
    if (file.status === nodegit.Status.STATUS.WT_DELETED) {
      await index.removeByPath(file.path);
    } else {
      await index.addByPath(file.path);
    }
  }

  await (index.write() as any);
  await index.writeTree();

  event.sender.send('status', { files: await getGitStatus(windowData.repo) });
});

ipcMain.on('unstage', async(event: Event, files: File[]) => {
  const windowData = webContentsMap.get(event.sender);
  if (!windowData || !windowData.repo) {
    throw new Error('Repository not loaded');
  }

  const commit = await windowData.repo.getHeadCommit();
  for (const file of files) {
    await nodegit.Reset.default(windowData.repo, commit as any, [file.path]);
  }
  const index = await windowData.repo.refreshIndex();
  await index.writeTree();

  event.sender.send('status', { files: await getGitStatus(windowData.repo) });
});

function createWindow(repoPath: string) {
  if (windowsData[repoPath]) {
    windowsData[repoPath].window.focus();
  } else {
    windowsData[repoPath] = getWindow(repoPath, removeWindow);
    webContentsMap.set(windowsData[repoPath].window.webContents, windowsData[repoPath]);
  }
}

function removeWindow(repoPath: string) {
  delete windowsData[repoPath];
}

function getWindow(repoPath: string, windowClosed: (repoPath: string) => void) {
  const window = new BrowserWindow({
    title: '',
    width: 1024,
    height: 768,
    minHeight: 480,
    minWidth: 640,
    titleBarStyle: 'hidden',
  });

  const windowData: WindowData = {
    path: repoPath,
    window: window,
    repo: undefined,
  };

  window.webContents.on('did-finish-load', () => {
    nodegit.Repository.open(repoPath).then(async (repo) => {
      windowData.repo = repo;
      const currentBranch = await repo.getCurrentBranch();
      window.webContents.send('init', { path: repoPath, branch: currentBranch.shorthand() });
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
            windowClosed(repoPath);
          },
        );
      }
    });
  });

  window.loadFile('app/index.html');

  window.on('closed', () => windowClosed(repoPath));

  return windowData;
}

async function countFileLines(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    exec(`wc -l "${filePath}"`, function (error, results) {
      if (error) {
        return reject(error);
      }
      const match = results.trim().match(/^(\d+)/);
      if (!match) {
        return reject(new Error('Results'));
      }
      resolve(Number(match[1]));
    });
  });
}


async function getFileDiff(repo: nodegit.Repository, file: File, staged: boolean) {
  const index = await repo.refreshIndex();
  if (staged) {
    const head = await repo.getHeadCommit();
    const tree = head ? await head.getTree() : await nodegit.Tree.lookup(repo, emptyTreeId());
    const diff = await nodegit.Diff.treeToIndex(repo, tree, index, { flags: untrackedFlags, pathspec: [file.path] });
    return await diff.toBuf(nodegit.Diff.FORMAT.PATCH);
  }
  else {
    const diff = await nodegit.Diff.indexToWorkdir(repo, index, { flags: untrackedFlags, pathspec: [file.path] });
    return await diff.toBuf(nodegit.Diff.FORMAT.PATCH);
  }
}

async function getGitStatus(repo: nodegit.Repository) {
  const files: File[] = [];
  await nodegit.Status.foreach(repo, (filePath: string, status: number) => {
    files.push({ path: filePath, status: status });
  });
  return files.filter((file) => file.status !== nodegit.Status.STATUS.IGNORED);
}

function chooseRepo() {
  dialog.showOpenDialog({ properties: ['openDirectory'] }, (folders) => {
    if (folders) {
      createWindow(folders[0]);
    }
  });
}
