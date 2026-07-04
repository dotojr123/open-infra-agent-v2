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
import { ExecutionEngine } from './runtime/execution-engine';

interface CreateSessionDto {
  sessionId?: string;
  runtimeName?: string;
}

interface CreateSessionWithUserDto {
  sessionId?: string;
  runtimeName?: string;
  linuxUser?: string;
  linuxPassword?: string;
  vncPassword?: string;
}

@Controller('sessions')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly executionEngine: ExecutionEngine) {}

  @Get()
  async listSessions() {
    const sessions = this.executionEngine.listSessions();
    return {
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        runtime: s.runtimeName,
        vncDisplay: s.vncDisplay,
        vncPort: s.vncPort,
        webUrl: s.webUrl,
        linuxUser: s.linuxUser,
        createdAt: s.createdAt,
        status: s.status,
      })),
    };
  }

  @Post()
  @HttpCode(201)
  async createSession(@Body() body: CreateSessionDto) {
    const sessionId = body.sessionId || `session-${Date.now()}`;
    const session = await this.executionEngine.createSession(
      sessionId,
      body.runtimeName,
    );

    const info = this.executionEngine.getSessionInfo(session.sessionId);
    if (!info) {
      return {
        success: false,
        message: 'Session created but info not available',
      };
    }

    return {
      success: true,
      message: 'Session created successfully',
      session: {
        sessionId: session.sessionId,
        runtime: info.runtimeName,
        vncDisplay: info.vncDisplay,
        vncPort: info.vncPort,
        webUrl: info.webUrl,
        linuxUser: info.linuxUser,
      },
    };
  }

  @Get(':sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    const info = this.executionEngine.getSessionInfo(sessionId);
    if (!info) {
      return {
        success: false,
        message: `Session "${sessionId}" not found`,
      };
    }

    return {
      success: true,
      session: {
        sessionId: info.sessionId,
        runtime: info.runtimeName,
        vncDisplay: info.vncDisplay,
        vncPort: info.vncPort,
        webUrl: info.webUrl,
        linuxUser: info.linuxUser,
        createdAt: info.createdAt,
        status: info.status,
      },
    };
  }

  @Delete(':sessionId')
  async destroySession(@Param('sessionId') sessionId: string) {
    const destroyed = await this.executionEngine.destroySession(sessionId);
    if (destroyed) {
      return {
        success: true,
        message: `Session "${sessionId}" destroyed successfully`,
      };
    }
    return {
      success: false,
      message: `Session "${sessionId}" not found or could not be destroyed`,
    };
  }
}