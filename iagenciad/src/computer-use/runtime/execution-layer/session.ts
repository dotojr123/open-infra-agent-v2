import { WorkspaceManager } from '../engines/workspace.manager';
import { ExecutionRuntimeV1 } from '../runtime-v1.interface';
import { EventBus } from './event-bus';

export class ExecutionSession {
  readonly workspace: WorkspaceManager;

  constructor(
    readonly sessionId: string,
    readonly activeRuntime: ExecutionRuntimeV1,
    private readonly eventBus: EventBus,
  ) {
    this.workspace = this.activeRuntime.getWorkspaceManager(this.sessionId);
  }

  async initialize(): Promise<void> {
    await this.workspace.initialize();
    this.eventBus.emit('SessionCreated', {
      sessionId: this.sessionId,
      runtime: this.activeRuntime.name,
    });
  }

  async destroy(): Promise<void> {
    await this.workspace.destroy();
    this.eventBus.emit('SessionDestroyed', { sessionId: this.sessionId });
  }
}
