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

export interface VncSessionConfig {
  display: number;
  vncPort: number;
  webPort: number;
  linuxUser: string;
  linuxPassword: string;
  vncPassword: string;
  geometry: string;
  depth: number;
}

@Injectable()
export class SshVncRuntime
  implements
    ExecutionRuntimeV1,
    FilesystemEngine,
    ProcessRunnerEngine
{
  readonly name = 'ssh-vnc';
  readonly priority = 14;
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

  private readonly logger = new Logger(SshVncRuntime.name);
  private host: string | null = null;
  private user: string;
  private port: number;
  private password: string;
  private readonly environmentService = new EnvironmentService();
  private readonly vncSessions = new Map<string, VncSessionConfig>();

  constructor(private readonly configService: ConfigService) {
    this.host = this.configService.get<string>('SSH_HOST') || null;
    this.user = this.configService.get<string>('SSH_USER', 'user');
    this.port = this.configService.get<number>('SSH_PORT', 22);
    this.password = this.configService.get<string>('SSH_PASSWORD', '');
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

  // ============================================================
  // VNC Session Management (Multi-User Support)
  // ============================================================

  async createVncSession(
    sessionId: string,
    config: Partial<VncSessionConfig>,
  ): Promise<VncSessionConfig> {
    const execAsync = promisify(exec);
    const linuxUser = config.linuxUser || `agent_${sessionId}`;
    const linuxPassword = config.linuxPassword || 'iagencia';
    const vncPassword = config.vncPassword || 'iagencia';
    const display = config.display || 10;
    const vncPort = config.vncPort || 5910;
    const webPort = config.webPort || 6010;
    const geometry = config.geometry || '1280x720';
    const depth = config.depth || 24;

    this.logger.log(
      `Creating VNC session for user "${linuxUser}" on display :${display}...`,
    );

    // Step 1: Create Linux user if not exists (use -S for non-interactive sudo)
    const createUserCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "echo '${this.password}' | sudo -S useradd -m -s /bin/bash -p $(openssl passwd -1 '${linuxPassword}') ${linuxUser} 2>/dev/null || true"`;
    await execAsync(createUserCmd);

    // Step 2: Grant sudo access without password
    const grantSudoCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "echo '${linuxUser} ALL=(ALL) NOPASSWD:ALL' | sudo -S tee /etc/sudoers.d/${linuxUser}"`;
    await execAsync(grantSudoCmd);

    // Step 3: Set up VNC password for user
    const vncPasswdCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "sudo -u ${linuxUser} mkdir -p ~/.vnc && echo '${vncPassword}' | sudo -u ${linuxUser} vncpasswd -f > /home/${linuxUser}/.vnc/passwd && sudo -u ${linuxUser} chmod 600 /home/${linuxUser}/.vnc/passwd"`;
    await execAsync(vncPasswdCmd);

    // Step 4: Create xstartup script
    const xstartupContent = `#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec openbox-session &
xterm -geometry 80x24+10+10 -ls -title "Terminal" &
`;
    const xstartupCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "echo '${xstartupContent.replace(/\n/g, '\\n')}' | sudo -u ${linuxUser} tee /home/${linuxUser}/.vnc/xstartup && sudo -u ${linuxUser} chmod +x /home/${linuxUser}/.vnc/xstartup"`;
    await execAsync(xstartupCmd);

    // Step 5: Start Xvfb for this user
    const xvfbCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "sudo -u ${linuxUser} Xvfb :${display} -screen 0 ${geometry}x${depth} -ac -nolisten tcp &"`;
    await execAsync(xvfbCmd);

    // Step 6: Start VNC server for this user
    const vncCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "sudo -u ${linuxUser} x11vnc -display :${display} -N -forever -shared -rfbport ${vncPort} -passwd ${vncPassword} &"`;
    await execAsync(vncCmd);

    // Step 7: Start websockify for noVNC
    const websockifyCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "websockify ${webPort} localhost:${vncPort} &"`;
    await execAsync(websockifyCmd);

    const sessionConfig: VncSessionConfig = {
      display,
      vncPort,
      webPort,
      linuxUser,
      linuxPassword,
      vncPassword,
      geometry,
      depth,
    };

    this.vncSessions.set(sessionId, sessionConfig);

    this.logger.log(
      `VNC session created: urel="http://<host>:${webPort}/vnc.html" user="${linuxUser}" display=:${display}`,
    );

    return sessionConfig;
  }

  async destroyVncSession(sessionId: string): Promise<boolean> {
    const execAsync = promisify(exec);
    const session = this.vncSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`VNC session "${sessionId}" not found.`);
      return false;
    }

    this.logger.log(
      `Destroying VNC session for user "${session.linuxUser}"...`,
    );

    // Kill VNC processes
    const killCmd = `ssh -p ${this.port} -o StrictHostKeyChecking=no ${this.user}@${this.host} "pkill -u ${session.linuxUser} -f 'Xvfb :${session.display}' || true; pkill -u ${session.linuxUser} -f 'x11vnc.*${session.vncPort}' || true; pkill -f 'websockify.*${session.webPort}' || true"`;
    await execAsync(killCmd);

    this.vncSessions.delete(sessionId);

    this.logger.log(`VNC session "${sessionId}" destroyed.`);
    return true;
  }

  getVncSession(sessionId: string): VncSessionConfig | null {
    return this.vncSessions.get(sessionId) || null;
  }

  listVncSessions(): VncSessionConfig[] {
    return Array.from(this.vncSessions.values());
  }

  // ============================================================
  // Filesystem Operations
  // ============================================================

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

  // ============================================================
  // Process Runner Operations
  // ============================================================

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