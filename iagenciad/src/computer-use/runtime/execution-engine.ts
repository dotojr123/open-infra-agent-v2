/* eslint-disable */
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ComputerAction } from '@iagencia/shared';
import { ExecutionRuntimeV1, EXECUTION_RUNTIME } from './runtime-v1.interface';
import { ExecutionSession } from './execution-layer/session';
import { EventBus } from './execution-layer/event-bus';
import { CommandPipeline } from './execution-layer/command-pipeline';
import { SessionManager } from './execution-layer/session-manager';

@Injectable()
export class ExecutionEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExecutionEngine.name);
  private readonly dynamicRuntimes = new Map<string, ExecutionRuntimeV1>();
  private activeRuntime: ExecutionRuntimeV1 | null = null;
  private defaultSession: ExecutionSession | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly sessionManager: SessionManager;

  constructor(
    @Inject(EXECUTION_RUNTIME)
    private readonly injectedRuntimes: ExecutionRuntimeV1[],
    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    private readonly commandPipeline: CommandPipeline,
  ) {
    this.sessionManager = new SessionManager(this.eventBus);
  }

  async onModuleInit() {
    await this.selectActiveRuntime();
    // Start default session for simple legacy calls
    this.defaultSession = new ExecutionSession(
      'default-session',
      this.getActiveRuntime(),
      this.eventBus,
    );
    await this.defaultSession.initialize();
    this.startHealthMonitoring();
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.defaultSession) {
      this.defaultSession.destroy().catch(() => {});
    }
  }

  registerRuntime(runtime: ExecutionRuntimeV1) {
    this.logger.log(`Registering dynamic execution runtime: ${runtime.name}`);
    this.dynamicRuntimes.set(runtime.name.toLowerCase(), runtime);
  }

  getRuntimes(): ExecutionRuntimeV1[] {
    return [...this.injectedRuntimes, ...this.dynamicRuntimes.values()].sort(
      (a, b) => b.priority - a.priority,
    );
  }

  getActiveRuntime(): ExecutionRuntimeV1 {
    if (!this.activeRuntime) {
      throw new Error('No active execution runtime initialized.');
    }
    return this.activeRuntime;
  }

  /**
   * Main method to execute computer actions.
   */
  async executeAction(
    action: ComputerAction,
    session?: ExecutionSession,
  ): Promise<any> {
    const activeSession = session || this.defaultSession;
    if (!activeSession) {
      throw new Error('No active execution session.');
    }

    const runtime = activeSession.activeRuntime;
    const startTime = Date.now();

    this.logger.log(
      `Session "${activeSession.sessionId}" routing action "${action.action}" to runtime "${runtime.name}"`,
    );

    try {
      let result: any;

      switch (action.action) {
        case 'bash_execute': {
          if (!runtime.capabilities.shell) {
            throw new Error(
              `Runtime "${runtime.name}" does not support shell execution.`,
            );
          }
          // Process command through pipeline
          const finalCmd = await this.commandPipeline.intercept(action.command);
          result = await runtime.getProcessRunner().execute(finalCmd);
          break;
        }

        case 'write_file': {
          if (!runtime.capabilities.filesystem) {
            throw new Error(
              `Runtime "${runtime.name}" does not support filesystem writes.`,
            );
          }
          // Workspace isolation mapping
          const resolvedPath = activeSession.workspace.resolve(action.path);
          result = await runtime
            .getFilesystem()
            .writeFile(resolvedPath, action.data);
          break;
        }

        case 'read_file': {
          if (!runtime.capabilities.filesystem) {
            throw new Error(
              `Runtime "${runtime.name}" does not support filesystem reads.`,
            );
          }
          const resolvedPath = activeSession.workspace.resolve(action.path);
          result = await runtime.getFilesystem().readFile(resolvedPath);
          break;
        }

        case 'screenshot':
          if (!runtime.capabilities.display) {
            throw new Error(
              `Runtime "${runtime.name}" does not support screenshot capture.`,
            );
          }
          if (!runtime.getDisplayController) {
            throw new Error(
              `Runtime "${runtime.name}" does not implement DisplayController.`,
            );
          }
          result = await runtime.getDisplayController().screenshot();
          break;

        case 'cursor_position':
          if (!runtime.capabilities.display) {
            throw new Error(
              `Runtime "${runtime.name}" does not support display coordinates.`,
            );
          }
          if (!runtime.getDisplayController) {
            throw new Error(
              `Runtime "${runtime.name}" does not implement DisplayController.`,
            );
          }
          result = await runtime.getDisplayController().cursorPosition();
          break;

        case 'application':
          if (!runtime.capabilities.gui) {
            throw new Error(
              `Runtime "${runtime.name}" does not support application launching.`,
            );
          }
          if (!runtime.getDisplayController) {
            throw new Error(
              `Runtime "${runtime.name}" does not implement DisplayController.`,
            );
          }
          result = await runtime
            .getDisplayController()
            .application(action.application, action.application);
          break;

        case 'wait':
          result = await new Promise((resolve) =>
            setTimeout(resolve, action.duration),
          );
          break;

        // Input simulation
        case 'move_mouse':
        case 'trace_mouse':
        case 'click_mouse':
        case 'press_mouse':
        case 'drag_mouse':
        case 'scroll': {
          if (!runtime.capabilities.mouse) {
            throw new Error(
              `Runtime "${runtime.name}" does not support mouse input simulation.`,
            );
          }
          if (!runtime.getInputController) {
            throw new Error(
              `Runtime "${runtime.name}" does not implement InputController.`,
            );
          }
          const input = runtime.getInputController();
          if (action.action === 'move_mouse')
            result = await input.moveMouse(action);
          if (action.action === 'trace_mouse')
            result = await input.traceMouse(action);
          if (action.action === 'click_mouse')
            result = await input.clickMouse(action);
          if (action.action === 'press_mouse')
            result = await input.pressMouse(action);
          if (action.action === 'drag_mouse')
            result = await input.dragMouse(action);
          if (action.action === 'scroll') result = await input.scroll(action);
          break;
        }

        case 'type_keys':
        case 'press_keys':
        case 'type_text':
        case 'paste_text': {
          if (!runtime.capabilities.keyboard) {
            throw new Error(
              `Runtime "${runtime.name}" does not support keyboard input simulation.`,
            );
          }
          if (!runtime.getInputController) {
            throw new Error(
              `Runtime "${runtime.name}" does not implement InputController.`,
            );
          }
          const input = runtime.getInputController();
          if (action.action === 'type_keys')
            result = await input.typeKeys(action);
          if (action.action === 'press_keys')
            result = await input.pressKeys(action);
          if (action.action === 'type_text')
            result = await input.typeText(action);
          if (action.action === 'paste_text')
            result = await input.pasteText(action);
          break;
        }

        default:
          throw new Error(`Unsupported action: ${(action as any).action}`);
      }

      const duration = Date.now() - startTime;
      this.eventBus.emit('ActionExecuted', {
        action: action.action,
        duration,
        success: true,
      });
      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      this.eventBus.emit('ActionExecuted', {
        action: action.action,
        duration,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  private async selectActiveRuntime(): Promise<void> {
    const runtimes = this.getRuntimes();

    const forced = this.configService.get<string>('EXECUTION_RUNTIME');
    if (forced) {
      const match = runtimes.find(
        (r) => r.name.toLowerCase() === forced.toLowerCase(),
      );
      if (match) {
        this.logger.log(`Selecting forced runtime: ${match.name}`);
        await match.initialize();
        this.activeRuntime = match;
        return;
      }
      this.logger.warn(
        `Forced runtime "${forced}" not found. Running auto-detection.`,
      );
    }

    for (const runtime of runtimes) {
      try {
        if (await runtime.isAvailable()) {
          this.logger.log(`Selecting runtime: ${runtime.name}`);
          await runtime.initialize();
          this.activeRuntime = runtime;
          return;
        }
      } catch (err: any) {
        this.logger.debug(
          `Runtime ${runtime.name} not available: ${err.message}`,
        );
      }
    }

    throw new Error('No available execution runtime found.');
  }

  private startHealthMonitoring() {
    const intervalMs = this.configService.get<number>(
      'RUNTIME_HEALTH_INTERVAL',
      15000,
    );
    this.healthCheckInterval = setInterval(async () => {
      if (!this.activeRuntime) return;

      try {
        const check = await this.activeRuntime.health();
        if (check.status === 'unhealthy') {
          this.logger.warn(
            `Active runtime "${this.activeRuntime.name}" is UNHEALTHY: ${check.diagnostics}`,
          );
          await this.recoverActiveRuntime();
        }
      } catch (err: any) {
        this.logger.error(
          `Error checking health of active runtime: ${err.message}`,
        );
        await this.recoverActiveRuntime();
      }
    }, intervalMs);
  }

  private async recoverActiveRuntime(): Promise<void> {
    if (!this.activeRuntime) return;

    this.logger.log(
      `Attempting recovery for active runtime: ${this.activeRuntime.name}...`,
    );
    try {
      await this.activeRuntime.shutdown().catch(() => {});
      await this.activeRuntime.initialize();
      const check = await this.activeRuntime.health();
      if (check.status === 'healthy') {
        this.logger.log(
          `Recovery successful. Runtime "${this.activeRuntime.name}" is healthy again.`,
        );
        return;
      }
    } catch (err: any) {
      this.logger.warn(
        `Recovery failed for "${this.activeRuntime.name}": ${err.message}`,
      );
    }

    // Failover
    this.logger.warn(
      `Triggering failover. Searching for alternative execution runtimes...`,
    );
    const oldName = this.activeRuntime.name;
    const runtimes = this.getRuntimes().filter((r) => r.name !== oldName);

    for (const runtime of runtimes) {
      try {
        if (await runtime.isAvailable()) {
          this.logger.log(
            `Failing over from "${oldName}" to "${runtime.name}"`,
          );
          await runtime.initialize();
          this.activeRuntime = runtime;
          if (this.defaultSession) {
            // Re-bind legacy session
            this.defaultSession = new ExecutionSession(
              'default-session',
              runtime,
              this.eventBus,
            );
            await this.defaultSession.initialize();
          }
          return;
        }
      } catch (err: any) {
        this.logger.debug(
          `Failover target "${runtime.name}" not available: ${err.message}`,
        );
      }
    }

    this.logger.error(
      'CRITICAL: All fallback execution runtimes are unavailable!',
    );
  }

  // ============================================================
  // Session Management API (Multi-VNC / Multi-User Support)
  // ============================================================

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  async createSession(
    sessionId: string,
    runtimeName?: string,
  ): Promise<ExecutionSession> {
    let runtime: ExecutionRuntimeV1;

    if (runtimeName) {
      const found = this.getRuntimes().find(
        (r) => r.name.toLowerCase() === runtimeName.toLowerCase(),
      );
      if (!found) {
        throw new Error(`Runtime "${runtimeName}" not found.`);
      }
      runtime = found;
    } else {
      runtime = this.getActiveRuntime();
    }

    const vncResources = this.sessionManager.allocateVncResources();

    const config = {
      sessionId,
      runtimeName: runtime.name,
      vncDisplay: vncResources.display,
      vncPort: vncResources.vncPort,
      webPort: vncResources.webPort,
    };

    return this.sessionManager.createSession(config, runtime);
  }

  getSession(sessionId: string): ExecutionSession | null {
    return this.sessionManager.getSession(sessionId);
  }

  getSessionInfo(sessionId: string) {
    return this.sessionManager.getSessionInfo(sessionId);
  }

  listSessions() {
    return this.sessionManager.listSessions();
  }

  async destroySession(sessionId: string): Promise<boolean> {
    return this.sessionManager.destroySession(sessionId);
  }
}
