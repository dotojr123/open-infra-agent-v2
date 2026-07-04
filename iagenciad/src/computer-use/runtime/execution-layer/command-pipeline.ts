/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from './event-bus';

@Injectable()
export class CommandPipeline {
  private readonly logger = new Logger(CommandPipeline.name);
  private readonly blocklist = [/rm\s+-rf\s+\/($|\s)/, /mkfs/, /dd\s+if=/];

  constructor(private readonly eventBus: EventBus) {}

  async intercept(command: string): Promise<string> {
    const startTime = Date.now();
    this.logger.log(`Intercepting command: ${command}`);

    // Policy Enforcement / Authorization
    for (const pattern of this.blocklist) {
      if (pattern.test(command)) {
        this.eventBus.emit('CommandBlocked', {
          command,
          reason: 'Security Policy Violation',
        });
        throw new Error(
          `Command blocked by policy: Destructive command detected.`,
        );
      }
    }

    // Command transformation could go here (e.g. replacing placeholder variables)
    const processedCommand = command.trim();

    this.eventBus.emit('CommandExecuting', { command: processedCommand });

    // We return the processed command to be run.
    // Telemetry is emitted after completion at the execution engine side,
    // but we can register the start details.
    return processedCommand;
  }
}
