/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { ExecutionSession } from './session';
import { ExecutionRuntimeV1 } from '../runtime-v1.interface';
import { EventBus } from './event-bus';

export interface SessionConfig {
  sessionId: string;
  runtimeName?: string;
  vncDisplay?: number;
  vncPort?: number;
  webPort?: number;
  linuxUser?: string;
  linuxPassword?: string;
}

export interface SessionInfo {
  sessionId: string;
  runtimeName: string;
  vncDisplay?: number;
  vncPort?: number;
  webUrl?: string;
  linuxUser?: string;
  createdAt: Date;
  status: 'active' | 'destroyed';
}

@Injectable()
export class SessionManager {
  private readonly logger = new Logger(SessionManager.name);
  private readonly sessions = new Map<string, ExecutionSession>();
  private readonly sessionConfigs = new Map<string, SessionConfig>();
  private readonly sessionInfo = new Map<string, SessionInfo>();
  private nextDisplayId = 10;
  private nextVncPort = 5910;
  private nextWebPort = 6010;

  constructor(private readonly eventBus: EventBus) {}

  async createSession(
    config: SessionConfig,
    runtime: ExecutionRuntimeV1,
  ): Promise<ExecutionSession> {
    const sessionId = config.sessionId || this.generateSessionId();

    this.logger.log(`Creating session "${sessionId}"...`);

    const session = new ExecutionSession(sessionId, runtime, this.eventBus);
    await session.initialize();

    this.sessions.set(sessionId, session);

    const info: SessionInfo = {
      sessionId,
      runtimeName: runtime.name,
      vncDisplay: config.vncDisplay,
      vncPort: config.vncPort,
      webUrl: config.webPort
        ? `http://<host>:${config.webPort}/vnc.html`
        : undefined,
      linuxUser: config.linuxUser,
      createdAt: new Date(),
      status: 'active',
    };

    this.sessionConfigs.set(sessionId, config);
    this.sessionInfo.set(sessionId, info);

    this.eventBus.emit('SessionCreated', {
      sessionId,
      runtime: runtime.name,
      vncDisplay: config.vncDisplay,
      linuxUser: config.linuxUser,
    });

    this.logger.log(
      `Session "${sessionId}" created successfully on runtime "${runtime.name}"`,
    );

    return session;
  }

  getSession(sessionId: string): ExecutionSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getSessionInfo(sessionId: string): SessionInfo | null {
    return this.sessionInfo.get(sessionId) || null;
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessionInfo.values()).filter(
      (info) => info.status === 'active',
    );
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session "${sessionId}" not found for destruction.`);
      return false;
    }

    this.logger.log(`Destroying session "${sessionId}"...`);

    try {
      await session.destroy();
      this.sessions.delete(sessionId);

      const info = this.sessionInfo.get(sessionId);
      if (info) {
        info.status = 'destroyed';
        this.sessionInfo.set(sessionId, info);
      }

      this.eventBus.emit('SessionDestroyed', { sessionId });

      this.logger.log(`Session "${sessionId}" destroyed successfully.`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Error destroying session "${sessionId}": ${err.message}`,
      );
      return false;
    }
  }

  allocateVncResources(): {
    display: number;
    vncPort: number;
    webPort: number;
  } {
    const display = this.nextDisplayId++;
    const vncPort = this.nextVncPort++;
    const webPort = this.nextWebPort++;

    return { display, vncPort, webPort };
  }

  generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async shutdown(): Promise<void> {
    this.logger.log('Shutting down SessionManager...');

    for (const [sessionId, session] of this.sessions.entries()) {
      await this.destroySession(sessionId);
    }

    this.sessions.clear();
    this.sessionConfigs.clear();
    this.sessionInfo.clear();
  }
}