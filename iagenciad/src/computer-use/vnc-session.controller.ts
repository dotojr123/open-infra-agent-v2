/* eslint-disable */
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { SshVncRuntime } from './runtime/plugins/ssh-vnc.runtime';
import { SessionManager } from './runtime/execution-layer/session-manager';

interface CreateVncSessionDto {
  sessionId?: string;
  linuxUser?: string;
  linuxPassword?: string;
  vncPassword?: string;
  geometry?: string;
  depth?: number;
}

@Controller('vnc-sessions')
export class VncSessionController {
  private readonly logger = new Logger(VncSessionController.name);

  constructor(
    private readonly sshVncRuntime: SshVncRuntime,
    private readonly sessionManager: SessionManager,
  ) {}

  @Post()
  @HttpCode(201)
  async createVncSession(@Body() body: CreateVncSessionDto) {
    try {
      const sessionId = body.sessionId || `vnc-${Date.now()}`;
      const linuxUser = body.linuxUser || `agent_${sessionId.replace(/[^a-z0-9]/gi, '_')}`;

      const config = await this.sshVncRuntime.createVncSession(sessionId, {
        linuxUser,
        linuxPassword: body.linuxPassword || 'iagencia',
        vncPassword: body.vncPassword || 'iagencia',
        geometry: body.geometry || '1280x720',
        depth: body.depth || 24,
      });

      return {
        success: true,
        message: 'VNC session created successfully',
        session: {
          sessionId,
          linuxUser: config.linuxUser,
          display: `:${config.display}`,
          vncPort: config.vncPort,
          webPort: config.webPort,
          webUrl: `http://<host>:${config.webPort}/vnc.html`,
          geometry: config.geometry,
          vncPassword: config.vncPassword,
        },
      };
    } catch (error: any) {
      this.logger.error(`Error creating VNC session: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get()
  async listVncSessions() {
    const sessions = this.sshVncRuntime.listVncSessions();
    return {
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => ({
        display: `:${s.display}`,
        vncPort: s.vncPort,
        webPort: s.webPort,
        webUrl: `http://<host>:${s.webPort}/vnc.html`,
        linuxUser: s.linuxUser,
        geometry: s.geometry,
      })),
    };
  }

  @Get(':sessionId')
  async getVncSession(@Param('sessionId') sessionId: string) {
    const session = this.sshVncRuntime.getVncSession(sessionId);
    if (!session) {
      return {
        success: false,
        message: `VNC session "${sessionId}" not found`,
      };
    }

    return {
      success: true,
      session: {
        sessionId,
        display: `:${session.display}`,
        vncPort: session.vncPort,
        webPort: session.webPort,
        webUrl: `http://<host>:${session.webPort}/vnc.html`,
        linuxUser: session.linuxUser,
        geometry: session.geometry,
        vncPassword: session.vncPassword,
      },
    };
  }

  @Delete(':sessionId')
  async destroyVncSession(@Param('sessionId') sessionId: string) {
    const destroyed = await this.sshVncRuntime.destroyVncSession(sessionId);
    if (destroyed) {
      return {
        success: true,
        message: `VNC session "${sessionId}" destroyed successfully`,
      };
    }
    return {
      success: false,
      message: `VNC session "${sessionId}" not found or could not be destroyed`,
    };
  }
}