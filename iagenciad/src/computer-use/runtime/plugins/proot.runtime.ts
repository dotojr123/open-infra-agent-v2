/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
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

@Injectable()
export class ProotRuntime
  implements ExecutionRuntimeV1, FilesystemEngine, ProcessRunnerEngine
{
  readonly name = 'proot';
  readonly priority = 20;
  readonly capabilities: RuntimeCapabilities = {
    shell: true,
    filesystem: true,
    keyboard: false,
    mouse: false,
    clipboard: false,
    display: false,
    gui: false,
    network: true,
  };

  private readonly logger = new Logger(ProotRuntime.name);
  private rootfsPath: string;
  private readonly environmentService = new EnvironmentService();

  constructor(private readonly configService: ConfigService) {
    this.rootfsPath = this.configService.get<string>(
      'PROOT_ROOTFS_PATH',
      '/home/user/rootfs',
    );
  }

  async isAvailable(): Promise<boolean> {
    const execAsync = promisify(exec);
    try {
      await execAsync('proot --version', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{
    status: 'healthy' | 'unhealthy';
    diagnostics?: string;
  }> {
    try {
      await fs.access(this.rootfsPath);
      return { status: 'healthy' };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        diagnostics: `Rootfs directory inaccessible: ${err.message}`,
      };
    }
  }

  async initialize(): Promise<void> {
    this.logger.log(
      `ProotRuntime initialized for rootfs path: ${this.rootfsPath}`,
    );
  }

  async shutdown(): Promise<void> {
    this.logger.log(`ProotRuntime shut down.`);
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
    throw new Error('Input capability not supported in PRoot.');
  }
  getDisplayController(): DisplayController {
    throw new Error('Display capability not supported in PRoot.');
  }

  // Filesystem
  async readFile(filePath: string): Promise<FileResult> {
    let relativePath = filePath;
    if (path.isAbsolute(relativePath)) {
      relativePath = relativePath.slice(1);
    }
    const targetPath = path.join(this.rootfsPath, relativePath);
    try {
      const buffer = await fs.readFile(targetPath);
      const stat = await fs.stat(targetPath);
      const ext = path.extname(targetPath).toLowerCase().slice(1);
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        txt: 'text/plain',
        png: 'image/png',
        jpg: 'image/jpeg',
      };
      return {
        success: true,
        data: buffer.toString('base64'),
        name: path.basename(targetPath),
        size: stat.size,
        mediaType: mimeTypes[ext] || 'application/octet-stream',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async writeFile(filePath: string, dataBase64: string): Promise<WriteResult> {
    let relativePath = filePath;
    if (path.isAbsolute(relativePath)) {
      relativePath = relativePath.slice(1);
    }
    const targetPath = path.join(this.rootfsPath, relativePath);
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const buffer = Buffer.from(dataBase64, 'base64');
      await fs.writeFile(targetPath, buffer);
      return {
        success: true,
        message: `File written inside PRoot rootfs to: ${filePath}`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // Process Runner
  async execute(command: string): Promise<ProcessResult> {
    const execAsync = promisify(exec);
    const cmd = `proot -r ${this.rootfsPath} bash -c ${JSON.stringify(command)}`;
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
}
