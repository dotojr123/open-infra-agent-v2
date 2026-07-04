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

@Injectable()
export class SshRuntime
  implements ExecutionRuntimeV1, FilesystemEngine, ProcessRunnerEngine
{
  readonly name = 'ssh';
  readonly priority = 15;
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

  private readonly logger = new Logger(SshRuntime.name);
  private host: string | null = null;
  private user: string;
  private port: number;
  private readonly environmentService = new EnvironmentService();

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>('SSH_HOST') || null;
    this.user = this.configService.get<string>('SSH_USER', 'user');
    this.port = this.configService.get<number>('SSH_PORT', 22);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.host) return false;
    const execAsync = promisify(exec);
    try {
      await execAsync(
        `ssh -o ConnectTimeout=3 -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} echo 1`,
        { timeout: 4000 },
      );
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{
    status: 'healthy' | 'unhealthy';
    diagnostics?: string;
  }> {
    const check = await this.isAvailable();
    if (check) {
      return { status: 'healthy' };
    }
    return {
      status: 'unhealthy',
      diagnostics: 'SSH remote host is not reachable.',
    };
  }

  async initialize(): Promise<void> {
    this.logger.log(`SshRuntime initialized for host: ${this.host}`);
  }

  async shutdown(): Promise<void> {
    this.logger.log(`SshRuntime shut down.`);
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
    throw new Error('Input capability not supported in SSH.');
  }
  getDisplayController(): DisplayController {
    throw new Error('Display capability not supported in SSH.');
  }

  // Filesystem
  async readFile(filePath: string): Promise<FileResult> {
    const execAsync = promisify(exec);
    const readCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "base64 ${filePath}"`;
    try {
      const { stdout } = await execAsync(readCmd);
      const base64Data = stdout.replace(/\s+/g, '');
      const sizeCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "stat -c '%s' ${filePath}"`;
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
    const setupCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "mkdir -p ${dir} && echo -n '${dataBase64}' | base64 -d > ${filePath} && chmod 644 ${filePath}"`;
    try {
      await execAsync(setupCmd);
      return {
        success: true,
        message: `File written over SSH to: ${filePath}`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // Process Runner
  async execute(command: string): Promise<ProcessResult> {
    const execAsync = promisify(exec);
    const cmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} ${JSON.stringify(command)}`;
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
