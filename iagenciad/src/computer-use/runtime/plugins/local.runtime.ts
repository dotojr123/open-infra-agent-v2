/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NutService } from '../../../nut/nut.service';
import { ExecutionRuntimeV1 } from '../runtime-v1.interface';
import {
  RuntimeCapabilities,
  FileResult,
  WriteResult,
  ProcessResult,
} from '../capabilities.types';
import { WorkspaceManager } from '../engines/workspace.manager';
import { EnvironmentService } from '../engines/environment.service';
import { FilesystemEngine } from '../engines/filesystem.engine';
import { ProcessRunnerEngine } from '../engines/process-runner.engine';
import { InputController } from '../engines/input.controller';
import { DisplayController } from '../engines/display.controller';
import {
  MoveMouseAction,
  TraceMouseAction,
  ClickMouseAction,
  PressMouseAction,
  DragMouseAction,
  ScrollAction,
  TypeKeysAction,
  PressKeysAction,
  TypeTextAction,
  PasteTextAction,
} from '@iagencia/shared';

@Injectable()
export class LocalRuntime
  implements
    ExecutionRuntimeV1,
    FilesystemEngine,
    ProcessRunnerEngine,
    InputController,
    DisplayController
{
  readonly name = 'local';
  readonly priority = 10;
  readonly capabilities: RuntimeCapabilities = {
    shell: true,
    filesystem: true,
    keyboard: true,
    mouse: true,
    clipboard: true,
    display: true,
    gui: true,
    network: true,
  };

  private readonly logger = new Logger(LocalRuntime.name);
  private readonly environmentService = new EnvironmentService();

  constructor(private readonly nutService: NutService) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async health(): Promise<{
    status: 'healthy' | 'unhealthy';
    diagnostics?: string;
  }> {
    return { status: 'healthy' };
  }

  async initialize(): Promise<void> {
    this.logger.log('LocalRuntime initialized.');
  }

  async shutdown(): Promise<void> {
    this.logger.log('LocalRuntime shut down.');
  }

  getWorkspaceManager(sessionId: string): WorkspaceManager {
    return new WorkspaceManager(sessionId);
  }

  getEnvironment(): EnvironmentService {
    return this.environmentService;
  }

  getFilesystem(): FilesystemEngine {
    return this;
  }
  getProcessRunner(): ProcessRunnerEngine {
    return this;
  }
  getInputController(): InputController {
    return this;
  }
  getDisplayController(): DisplayController {
    return this;
  }

  // Filesystem operations
  async readFile(filePath: string): Promise<FileResult> {
    try {
      const execFileAsync = promisify(execFile);
      const tempFile = `/tmp/iagencia_read_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      try {
        await execFileAsync('sudo', ['cp', filePath, tempFile]);
        await execFileAsync('sudo', ['chmod', '644', tempFile]);

        const buffer = await fs.readFile(tempFile);
        const { stdout: statOutput } = await execFileAsync('sudo', [
          'stat',
          '-c',
          '%s',
          filePath,
        ]);
        const fileSize = parseInt(statOutput.trim(), 10);
        await fs.unlink(tempFile).catch(() => {});

        const base64Data = buffer.toString('base64');
        const ext = path.extname(filePath).toLowerCase().slice(1);
        const mimeTypes: Record<string, string> = {
          pdf: 'application/pdf',
          txt: 'text/plain',
          png: 'image/png',
          jpg: 'image/jpeg',
        };

        return {
          success: true,
          data: base64Data,
          name: path.basename(filePath),
          size: fileSize,
          mediaType: mimeTypes[ext] || 'application/octet-stream',
        };
      } catch (error) {
        await fs.unlink(tempFile).catch(() => {});
        throw error;
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async writeFile(filePath: string, dataBase64: string): Promise<WriteResult> {
    try {
      const execFileAsync = promisify(execFile);
      const buffer = Buffer.from(dataBase64, 'base64');
      const dir = path.dirname(filePath);
      try {
        await execFileAsync('sudo', ['mkdir', '-p', dir]);
      } catch {}

      const tempFile = `/tmp/iagencia_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await fs.writeFile(tempFile, buffer);

      try {
        await execFileAsync('sudo', ['cp', tempFile, filePath]);
        await execFileAsync('sudo', ['chown', 'user:user', filePath]);
        await execFileAsync('sudo', ['chmod', '644', filePath]);
        await fs.unlink(tempFile).catch(() => {});
      } catch (error) {
        await fs.unlink(tempFile).catch(() => {});
        throw error;
      }

      return {
        success: true,
        message: `File written successfully to: ${filePath}`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // Process runner
  async execute(command: string): Promise<ProcessResult> {
    const execAsync = promisify(exec);
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      return { success: true, stdout, stderr };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout,
        stderr: error.stderr || error.message,
      };
    }
  }

  // Inputs
  async moveMouse(action: MoveMouseAction): Promise<void> {
    await this.nutService.mouseMoveEvent(action.coordinates);
  }

  async traceMouse(action: TraceMouseAction): Promise<void> {
    await this.nutService.mouseMoveEvent(action.path[0]);
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, true);
    }
    for (const coordinates of action.path) {
      await this.nutService.mouseMoveEvent(coordinates);
    }
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, false);
    }
  }

  async clickMouse(action: ClickMouseAction): Promise<void> {
    if (action.coordinates) {
      await this.nutService.mouseMoveEvent(action.coordinates);
    }
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, true);
    }
    if (action.clickCount > 1) {
      for (let i = 0; i < action.clickCount; i++) {
        await this.nutService.mouseClickEvent(action.button);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } else {
      await this.nutService.mouseClickEvent(action.button);
    }
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, false);
    }
  }

  async pressMouse(action: PressMouseAction): Promise<void> {
    if (action.coordinates) {
      await this.nutService.mouseMoveEvent(action.coordinates);
    }
    await this.nutService.mouseButtonEvent(
      action.button,
      action.press === 'down',
    );
  }

  async dragMouse(action: DragMouseAction): Promise<void> {
    await this.nutService.mouseMoveEvent(action.path[0]);
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, true);
    }
    await this.nutService.mouseButtonEvent(action.button, true);
    for (const coordinates of action.path) {
      await this.nutService.mouseMoveEvent(coordinates);
    }
    await this.nutService.mouseButtonEvent(action.button, false);
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, false);
    }
  }

  async scroll(action: ScrollAction): Promise<void> {
    if (action.coordinates) {
      await this.nutService.mouseMoveEvent(action.coordinates);
    }
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, true);
    }
    for (let i = 0; i < action.scrollCount; i++) {
      await this.nutService.mouseWheelEvent(action.direction, 1);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (action.holdKeys) {
      await this.nutService.holdKeys(action.holdKeys, false);
    }
  }

  async typeKeys(action: TypeKeysAction): Promise<void> {
    await this.nutService.sendKeys(action.keys, action.delay);
  }

  async pressKeys(action: PressKeysAction): Promise<void> {
    await this.nutService.holdKeys(action.keys, action.press === 'down');
  }

  async typeText(action: TypeTextAction): Promise<void> {
    await this.nutService.typeText(action.text, action.delay);
  }

  async pasteText(action: PasteTextAction): Promise<void> {
    await this.nutService.pasteText(action.text);
  }

  // Display
  async screenshot(): Promise<{ image: string }> {
    const buffer = await this.nutService.screendump();
    return { image: buffer.toString('base64') };
  }

  async cursorPosition(): Promise<{ x: number; y: number }> {
    return await this.nutService.getCursorPosition();
  }

  async application(
    action:
      | 'desktop'
      | 'firefox'
      | '1password'
      | 'thunderbird'
      | 'vscode'
      | 'terminal'
      | 'directory',
    applicationName: string,
  ): Promise<void> {
    const execFileAsync = promisify(execFile);
    const spawnAndForget = (command: string, args: string[]): void => {
      const child = spawn(command, args, {
        env: { ...process.env, DISPLAY: ':0.0' },
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
    };

    if (action === 'desktop') {
      spawnAndForget('sudo', ['-u', 'user', 'wmctrl', '-k', 'on']);
      return;
    }

    const commandMap: Record<string, string> = {
      firefox: 'firefox-esr',
      '1password': '1password',
      thunderbird: 'thunderbird',
      vscode: 'code',
      terminal: 'xfce4-terminal',
      directory: 'thunar',
    };

    const processMap: Record<string, string> = {
      firefox: 'Navigator.firefox-esr',
      '1password': '1password.1Password',
      thunderbird: 'Mail.thunderbird',
      vscode: 'code.Code',
      terminal: 'xfce4-terminal.Xfce4-Terminal',
      directory: 'Thunar',
      desktop: 'xfdesktop.Xfdesktop',
    };

    let appOpen = false;
    try {
      const { stdout } = await execFileAsync(
        'sudo',
        ['-u', 'user', 'wmctrl', '-lx'],
        { timeout: 5000 },
      );
      appOpen = stdout.includes(processMap[action]);
    } catch {}

    if (appOpen) {
      spawnAndForget('sudo', [
        '-u',
        'user',
        'wmctrl',
        '-x',
        '-a',
        processMap[action],
      ]);
      spawnAndForget('sudo', [
        '-u',
        'user',
        'wmctrl',
        '-x',
        '-r',
        processMap[action],
        '-b',
        'add,maximized_vert,maximized_horz',
      ]);
      return;
    }

    spawnAndForget('sudo', ['-u', 'user', 'nohup', commandMap[action]]);
  }
}
