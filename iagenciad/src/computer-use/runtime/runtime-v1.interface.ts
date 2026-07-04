import { RuntimeCapabilities } from './capabilities.types';
import { WorkspaceManager } from './engines/workspace.manager';
import { EnvironmentService } from './engines/environment.service';
import { FilesystemEngine } from './engines/filesystem.engine';
import { ProcessRunnerEngine } from './engines/process-runner.engine';
import { InputController } from './engines/input.controller';
import { DisplayController } from './engines/display.controller';

export interface ExecutionRuntimeV1 {
  readonly name: string;
  readonly priority: number;
  readonly capabilities: RuntimeCapabilities;

  isAvailable(): Promise<boolean>;
  health(): Promise<{ status: 'healthy' | 'unhealthy'; diagnostics?: string }>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  getWorkspaceManager(sessionId: string): WorkspaceManager;
  getEnvironment(): EnvironmentService;
  getFilesystem(): FilesystemEngine;
  getProcessRunner(): ProcessRunnerEngine;
  getInputController(): InputController;
  getDisplayController(): DisplayController;
}

export const EXECUTION_RUNTIME = 'EXECUTION_RUNTIME';
