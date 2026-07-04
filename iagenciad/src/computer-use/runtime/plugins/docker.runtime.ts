/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
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
export class DockerRuntime
  implements
    ExecutionRuntimeV1,
    FilesystemEngine,
    ProcessRunnerEngine,
    InputController,
    DisplayController
{
  readonly name = 'docker';
  readonly priority = 30;
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

  private readonly logger = new Logger(DockerRuntime.name);
  private containerName: string;
  private readonly environmentService = new EnvironmentService();

  constructor(private readonly configService: ConfigService) {
    this.containerName = this.configService.get<string>(
      'DOCKER_CONTAINER_NAME',
      'iagencia-desktop',
    );
  }

  async isAvailable(): Promise<boolean> {
    const execAsync = promisify(exec);
    try {
      await execAsync('docker ps', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{
    status: 'healthy' | 'unhealthy';
    diagnostics?: string;
  }> {
    const execAsync = promisify(exec);
    try {
      const { stdout } = await execAsync(
        `docker inspect -f "{{.State.Running}}" ${this.containerName}`,
        { timeout: 3000 },
      );
      if (stdout.trim() === 'true') {
        return { status: 'healthy' };
      }
      return { status: 'unhealthy', diagnostics: 'Container is not running.' };
    } catch (err: any) {
      return { status: 'unhealthy', diagnostics: err.message };
    }
  }

  async initialize(): Promise<void> {
    this.logger.log(
      `DockerRuntime initialized for container: ${this.containerName}`,
    );
  }

  async shutdown(): Promise<void> {
    this.logger.log(`DockerRuntime shut down.`);
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

  // Filesystem
  async readFile(filePath: string): Promise<FileResult> {
    const execAsync = promisify(exec);
    const readCmd = `docker exec ${this.containerName} base64 ${filePath}`;
    try {
      const { stdout } = await execAsync(readCmd);
      const base64Data = stdout.replace(/\s+/g, '');
      const sizeCmd = `docker exec ${this.containerName} stat -c "%s" ${filePath}`;
      const { stdout: sizeOut } = await execAsync(sizeCmd);
      const fileSize = parseInt(sizeOut.trim(), 10);
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
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async writeFile(filePath: string, dataBase64: string): Promise<WriteResult> {
    const execAsync = promisify(exec);
    const dir = path.dirname(filePath);
    const setupCmd = `docker exec ${this.containerName} bash -c "mkdir -p ${dir} && echo -n '${dataBase64}' | base64 -d > ${filePath} && chown user:user ${filePath} && chmod 644 ${filePath}"`;
    try {
      await execAsync(setupCmd);
      return {
        success: true,
        message: `File written inside container: ${filePath}`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // Process Runner
  async execute(command: string): Promise<ProcessResult> {
    const execAsync = promisify(exec);
    const cmd = `docker exec ${this.containerName} bash -c ${JSON.stringify(command)}`;
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      return { success: true, stdout, stderr };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout,
        stderr: error.stderr || error.message,
      };
    }
  }

  // Input
  async moveMouse(action: MoveMouseAction): Promise<void> {
    const execAsync = promisify(exec);
    await execAsync(
      `docker exec ${this.containerName} xdotool mousemove ${action.coordinates.x} ${action.coordinates.y}`,
    );
  }

  async traceMouse(action: TraceMouseAction): Promise<void> {
    const execAsync = promisify(exec);
    let cmd = `xdotool mousemove ${action.path[0].x} ${action.path[0].y}`;
    if (action.holdKeys) {
      cmd += ` keydown ${action.holdKeys.join(' keydown ')}`;
    }
    for (const p of action.path) {
      cmd += ` mousemove ${p.x} ${p.y}`;
    }
    if (action.holdKeys) {
      cmd += ` keyup ${action.holdKeys.join(' keyup ')}`;
    }
    await execAsync(`docker exec ${this.containerName} ${cmd}`);
  }

  async clickMouse(action: ClickMouseAction): Promise<void> {
    const execAsync = promisify(exec);
    let cmd = '';
    if (action.coordinates) {
      cmd += `xdotool mousemove ${action.coordinates.x} ${action.coordinates.y} `;
    }
    const btnMap = { left: '1', right: '3', middle: '2' };
    cmd += `xdotool click --repeat ${action.clickCount || 1} ${btnMap[action.button] || '1'}`;
    await execAsync(`docker exec ${this.containerName} ${cmd}`);
  }

  async pressMouse(action: PressMouseAction): Promise<void> {
    const execAsync = promisify(exec);
    let cmd = '';
    if (action.coordinates) {
      cmd += `xdotool mousemove ${action.coordinates.x} ${action.coordinates.y} `;
    }
    cmd += `xdotool ${action.press === 'down' ? 'mousedown' : 'mouseup'} ${action.button === 'left' ? '1' : action.button === 'right' ? '3' : '2'}`;
    await execAsync(`docker exec ${this.containerName} ${cmd}`);
  }

  async dragMouse(action: DragMouseAction): Promise<void> {
    const execAsync = promisify(exec);
    let cmd = `xdotool mousemove ${action.path[0].x} ${action.path[0].y} mousedown ${action.button === 'left' ? '1' : '3'}`;
    for (const p of action.path) {
      cmd += ` mousemove ${p.x} ${p.y}`;
    }
    cmd += ` mouseup ${action.button === 'left' ? '1' : '3'}`;
    await execAsync(`docker exec ${this.containerName} ${cmd}`);
  }

  async scroll(action: ScrollAction): Promise<void> {
    const execAsync = promisify(exec);
    const scrollKey =
      action.direction === 'up'
        ? '4'
        : action.direction === 'down'
          ? '5'
          : action.direction === 'left'
            ? '6'
            : '7';
    let cmd = '';
    if (action.coordinates) {
      cmd += `xdotool mousemove ${action.coordinates.x} ${action.coordinates.y} `;
    }
    cmd += `xdotool click --repeat ${action.scrollCount} ${scrollKey}`;
    await execAsync(`docker exec ${this.containerName} ${cmd}`);
  }

  async typeKeys(action: TypeKeysAction): Promise<void> {
    const execAsync = promisify(exec);
    await execAsync(
      `docker exec ${this.containerName} xdotool key ${action.keys.join('+')}`,
    );
  }

  async pressKeys(action: PressKeysAction): Promise<void> {
    const execAsync = promisify(exec);
    const act = action.press === 'down' ? 'keydown' : 'keyup';
    await execAsync(
      `docker exec ${this.containerName} xdotool ${act} ${action.keys.join(' ')}`,
    );
  }

  async typeText(action: TypeTextAction): Promise<void> {
    const execAsync = promisify(exec);
    const escaped = action.text.replace(/'/g, "'\\''");
    await execAsync(
      `docker exec ${this.containerName} xdotool type --delay ${action.delay || 12} '${escaped}'`,
    );
  }

  async pasteText(action: PasteTextAction): Promise<void> {
    const execAsync = promisify(exec);
    const escaped = action.text.replace(/'/g, "'\\''");
    await execAsync(
      `docker exec ${this.containerName} bash -c "echo -n '${escaped}' | xclip -selection clipboard" && docker exec ${this.containerName} xdotool key ctrl+v`,
    );
  }

  // Display
  async screenshot(): Promise<{ image: string }> {
    const execAsync = promisify(exec);
    const screenshotCmd = `docker exec ${this.containerName} scrot -o -z /tmp/shot.png && docker exec ${this.containerName} base64 /tmp/shot.png && docker exec ${this.containerName} rm -f /tmp/shot.png`;
    const { stdout } = await execAsync(screenshotCmd);
    return { image: stdout.replace(/\s+/g, '') };
  }

  async cursorPosition(): Promise<{ x: number; y: number }> {
    const execAsync = promisify(exec);
    const { stdout } = await execAsync(
      `docker exec ${this.containerName} xdotool getmouselocation --shell`,
    );
    const lines = stdout.split('\n');
    const x = parseInt(lines[0].split('=')[1], 10);
    const y = parseInt(lines[1].split('=')[1], 10);
    return { x, y };
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
    const execAsync = promisify(exec);
    const appCmd = `docker exec ${this.containerName} sudo -u user DISPLAY=:0.0 nohup ${applicationName} > /dev/null 2>&1 &`;
    await execAsync(appCmd);
  }
}
