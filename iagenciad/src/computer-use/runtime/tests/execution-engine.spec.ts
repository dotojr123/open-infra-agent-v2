/* eslint-disable */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionEngine } from '../execution-engine';
import { ExecutionRuntimeV1, EXECUTION_RUNTIME } from '../runtime-v1.interface';
import { EventBus } from '../execution-layer/event-bus';
import { CommandPipeline } from '../execution-layer/command-pipeline';

describe('ExecutionEngine', () => {
  let executionEngine: ExecutionEngine;
  let configService: ConfigService;

  const mockWorkspace = {
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  const mockLocalRuntime: ExecutionRuntimeV1 = {
    name: 'local',
    priority: 10,
    capabilities: {
      shell: true,
      filesystem: true,
      keyboard: true,
      mouse: true,
      clipboard: true,
      display: true,
      gui: true,
      network: true,
    },
    isAvailable: jest.fn().mockResolvedValue(true),
    health: jest.fn().mockResolvedValue({ status: 'healthy' }),
    initialize: jest.fn(),
    shutdown: jest.fn(),
    getWorkspaceManager: jest.fn().mockReturnValue(mockWorkspace),
    getEnvironment: jest.fn(),
    getFilesystem: jest.fn(),
    getProcessRunner: jest.fn(),
    getInputController: jest.fn(),
    getDisplayController: jest.fn(),
  };

  const mockDockerRuntime: ExecutionRuntimeV1 = {
    name: 'docker',
    priority: 30,
    capabilities: {
      shell: true,
      filesystem: true,
      keyboard: true,
      mouse: true,
      clipboard: true,
      display: true,
      gui: true,
      network: true,
    },
    isAvailable: jest.fn().mockResolvedValue(false),
    health: jest.fn().mockResolvedValue({ status: 'healthy' }),
    initialize: jest.fn(),
    shutdown: jest.fn(),
    getWorkspaceManager: jest.fn().mockReturnValue(mockWorkspace),
    getEnvironment: jest.fn(),
    getFilesystem: jest.fn(),
    getProcessRunner: jest.fn(),
    getInputController: jest.fn(),
    getDisplayController: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExecutionEngine,
        EventBus,
        {
          provide: CommandPipeline,
          useValue: {
            intercept: jest
              .fn()
              .mockImplementation((cmd) => Promise.resolve(cmd)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EXECUTION_RUNTIME,
          useValue: [mockLocalRuntime, mockDockerRuntime],
        },
      ],
    }).compile();

    executionEngine = moduleRef.get<ExecutionEngine>(ExecutionEngine);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(executionEngine).toBeDefined();
  });

  it('should auto-detect and select the local runtime if docker is unavailable', async () => {
    jest.spyOn(configService, 'get').mockReturnValue(null);
    await executionEngine.onModuleInit();
    expect(executionEngine.getActiveRuntime().name).toBe('local');
  });

  it('should failover to fallback runtime if the active one reports unhealthy', async () => {
    jest.spyOn(configService, 'get').mockReturnValue('docker');
    jest.spyOn(mockDockerRuntime, 'isAvailable').mockResolvedValue(true);
    jest
      .spyOn(mockDockerRuntime, 'health')
      .mockResolvedValue({ status: 'unhealthy', diagnostics: 'Crashed' });

    await executionEngine.onModuleInit();
    expect(executionEngine.getActiveRuntime().name).toBe('docker');

    await (executionEngine as any).recoverActiveRuntime();
    expect(executionEngine.getActiveRuntime().name).toBe('local');
  });
});
