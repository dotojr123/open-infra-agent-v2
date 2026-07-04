import { Module } from '@nestjs/common';
import { ComputerUseService } from './computer-use.service';
import { ComputerUseController } from './computer-use.controller';
import { SessionController } from './session.controller';
import { VncSessionController } from './vnc-session.controller';
import { NutModule } from '../nut/nut.module';
import { ExecutionEngine } from './runtime/execution-engine';
import { EXECUTION_RUNTIME } from './runtime/runtime.interface';
import { LocalRuntime } from './runtime/plugins/local.runtime';
import { DockerRuntime } from './runtime/plugins/docker.runtime';
import { ProotRuntime } from './runtime/plugins/proot.runtime';
import { SshRuntime } from './runtime/plugins/ssh.runtime';
import { SshVncRuntime } from './runtime/plugins/ssh-vnc.runtime';
import { EventBus } from './runtime/execution-layer/event-bus';
import { CommandPipeline } from './runtime/execution-layer/command-pipeline';
import { SessionManager } from './runtime/execution-layer/session-manager';

@Module({
  imports: [NutModule],
  controllers: [ComputerUseController, SessionController, VncSessionController],
  providers: [
    ComputerUseService,
    ExecutionEngine,
    SessionManager,
    LocalRuntime,
    DockerRuntime,
    ProotRuntime,
    SshRuntime,
    SshVncRuntime,
    EventBus,
    CommandPipeline,
    {
      provide: EXECUTION_RUNTIME,
      useFactory: (
        local: LocalRuntime,
        docker: DockerRuntime,
        proot: ProotRuntime,
        ssh: SshRuntime,
        sshVnc: SshVncRuntime,
      ) => [local, docker, proot, ssh, sshVnc],
      inject: [LocalRuntime, DockerRuntime, ProotRuntime, SshRuntime, SshVncRuntime],
    },
  ],
  exports: [ComputerUseService, ExecutionEngine, EventBus, CommandPipeline, SessionManager],
})
export class ComputerUseModule {}
