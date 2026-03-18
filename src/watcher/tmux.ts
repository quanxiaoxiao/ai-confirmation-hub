import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TmuxPaneRef {
  session: string;
  window: string;
  pane: string;
}

export interface TmuxPaneInfo extends TmuxPaneRef {
  windowName: string;
}

export async function listPanes(): Promise<TmuxPaneRef[]> {
  const infos = await listPanesDetailed();
  return infos.map(({ session, window: win, pane }) => ({ session, window: win, pane }));
}

export async function listPanesDetailed(): Promise<TmuxPaneInfo[]> {
  const { stdout } = await execFileAsync('tmux', [
    'list-panes',
    '-a',
    '-F',
    '#S\t#I\t#P\t#W'
  ]);

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return {
        session: parts[0] ?? '',
        window: parts[1] ?? '',
        pane: parts[2] ?? '',
        windowName: parts[3] ?? ''
      };
    });
}

export async function focusPane(paneRef: TmuxPaneRef): Promise<void> {
  const target = `${paneRef.session}:${paneRef.window}.${paneRef.pane}`;

  // Switch client to the target session
  await execFileAsync('tmux', ['switch-client', '-t', paneRef.session]);
  // Select the target window
  await execFileAsync('tmux', ['select-window', '-t', `${paneRef.session}:${paneRef.window}`]);
  // Select the target pane
  await execFileAsync('tmux', ['select-pane', '-t', target]);
}

export async function capturePaneText(
  paneRef: TmuxPaneRef,
  lines: number
): Promise<string> {
  const target = `${paneRef.session}:${paneRef.window}.${paneRef.pane}`;

  const { stdout } = await execFileAsync('tmux', [
    'capture-pane',
    '-p',
    '-t',
    target,
    '-S',
    `-${lines}`
  ]);

  return stdout;
}
