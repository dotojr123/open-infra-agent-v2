import { Module } from '@nestjs/common';
import { ComputerUseService } from './computer-use.service';
import { ComputerUseController } from './computer-use.controller';
import { NutModule } from '../nut/nut.module';
import { ExecutionEngine } from './runtime/execution-engine';
import { EXECUTION_RUNTIME } from './runtime/runtime.interface';
import { LocalRuntime } from './runtime/plugins/local.runtime';
import { DockerRuntime } from './runtime/plugins/docker.runtime';
import { ProotRuntime } from './runtime/plugins/proot.runtime';
import { SshRuntime } from './runtime/plugins/ssh.runtime';
import { EventBus } from './runtime/execution-layer/event-bus';
import { CommandPipeline } from './runtime/execution-layer/command-pipeline';

@Module({
  imports: [NutModule],
  controllers: [ComputerUseController],
  providers: [
    ComputerUseService,
    ExecutionEngine,
    LocalRuntime,
    DockerRuntime,
    ProotRuntime,
    SshRuntime,
    EventBus,
    CommandPipeline,
    {
      provide: EXECUTION_RUNTIME,
      useFactory: (
        local: LocalRuntime,
        docker: DockerRuntime,
        proot: ProotRuntime,
        ssh: SshRuntime,
      ) => [local, docker, proot, ssh],
      inject: [LocalRuntime, DockerRuntime, ProotRuntime, SshRuntime],
    },
  ],
  exports: [ComputerUseService, ExecutionEngine, EventBus, CommandPipeline],
})
export class ComputerUseModule {}
