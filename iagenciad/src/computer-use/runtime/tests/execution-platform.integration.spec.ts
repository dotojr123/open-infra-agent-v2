/* eslint-disable */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionEngine } from '../execution-engine';
import { ExecutionRuntimeV1, EXECUTION_RUNTIME } from '../runtime-v1.interface';
import { EventBus } from '../execution-layer/event-bus';
import { CommandPipeline } from '../execution-layer/command-pipeline';
import { ExecutionSession } from '../execution-layer/session';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Execution Platform Integration Tests', () => {
  let executionEngine: ExecutionEngine;
  let eventBus: EventBus;

  const mockWorkspace = (name: string) => ({
    initialize: jest.fn().mockImplementation(async () => {
      await fs.mkdir(path.join('/tmp/iagencia/sessions', name), {
        recursive: true,
      });
    }),
    destroy: jest.fn().mockImplementation(async () => {
      await fs
        .rm(path.join('/tmp/iagencia/sessions', name), {
          recursive: true,
          force: true,
        })
        .catch(() => {});
    }),
    resolve: jest
      .fn()
      .mockImplementation((file: string) =>
        path.join('/tmp/iagencia/sessions', name, file),
      ),
  });

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
    getWorkspaceManager: jest
      .fn()
      .mockImplementation((sessionId) => mockWorkspace(sessionId) as any),
    getEnvironment: jest.fn(),
    getFilesystem: jest.fn().mockReturnValue({
      writeFile: jest
        .fn()
        .mockImplementation(async (filePath: string, data: string) => {
          await fs.writeFile(filePath, Buffer.from(data, 'base64'));
          return { success: true, message: 'written' };
        }),
      readFile: jest.fn().mockImplementation(async (filePath: string) => {
        const buffer = await fs.readFile(filePath);
        return { success: true, data: buffer.toString('base64') };
      }),
    }),
    getProcessRunner: jest.fn().mockReturnValue({
      execute: jest
        .fn()
        .mockResolvedValue({ success: true, stdout: 'local run' }),
    }),
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
    isAvailable: jest.fn().mockResolvedValue(true),
    health: jest.fn().mockResolvedValue({ status: 'healthy' }),
    initialize: jest.fn(),
    shutdown: jest.fn(),
    getWorkspaceManager: jest
      .fn()
      .mockImplementation((sessionId) => mockWorkspace(sessionId) as any),
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
            get: jest.fn().mockImplementation((key) => {
              if (key === 'EXECUTION_RUNTIME') return 'docker';
              return null;
            }),
          },
        },
        {
          provide: EXECUTION_RUNTIME,
          useValue: [mockLocalRuntime, mockDockerRuntime],
        },
      ],
    }).compile();

    executionEngine = moduleRef.get<ExecutionEngine>(ExecutionEngine);
    eventBus = moduleRef.get<EventBus>(EventBus);
    await executionEngine.onModuleInit();
  });

  afterEach(async () => {
    executionEngine.onModuleDestroy();
    await fs
      .rm('/tmp/iagencia/sessions', { recursive: true, force: true })
      .catch(() => {});
  });

  it('should guarantee workspace isolation under concurrent sessions', async () => {
    const session1 = new ExecutionSession(
      'session-1',
      mockLocalRuntime,
      eventBus,
    );
    const session2 = new ExecutionSession(
      'session-2',
      mockLocalRuntime,
      eventBus,
    );

    await session1.initialize();
    await session2.initialize();

    // Session 1 writes temp.txt
    await executionEngine.executeAction(
      {
        action: 'write_file',
        path: 'temp.txt',
        data: Buffer.from('data-from-session-1').toString('base64'),
      },
      session1,
    );

    // Session 2 writes temp.txt with different content
    await executionEngine.executeAction(
      {
        action: 'write_file',
        path: 'temp.txt',
        data: Buffer.from('data-from-session-2').toString('base64'),
      },
      session2,
    );

    // Verify Session 1 content remains isolated and unmodified
    const read1 = await executionEngine.executeAction(
      {
        action: 'read_file',
        path: 'temp.txt',
      },
      session1,
    );

    const read2 = await executionEngine.executeAction(
      {
        action: 'read_file',
        path: 'temp.txt',
      },
      session2,
    );

    expect(Buffer.from(read1.data, 'base64').toString()).toBe(
      'data-from-session-1',
    );
    expect(Buffer.from(read2.data, 'base64').toString()).toBe(
      'data-from-session-2',
    );

    await session1.destroy();
    await session2.destroy();
  });
});
