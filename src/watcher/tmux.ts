import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TmuxPaneRef {
  session: string;
  window: string;
  pane: string;
}

export async function listPanes(): Promise<TmuxPaneRef[]> {
  const { stdout } = await execFileAsync('tmux', [
    'list-panes',
    '-a',
    '-F',
    '#S\t#I\t#P'
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
        pane: parts[2] ?? ''
      };
    });
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
