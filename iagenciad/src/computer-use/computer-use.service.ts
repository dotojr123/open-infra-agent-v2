/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { ComputerAction } from '@iagencia/shared';
import { ExecutionEngine } from './runtime/execution-engine';

@Injectable()
export class ComputerUseService {
  private readonly logger = new Logger(ComputerUseService.name);

  constructor(private readonly executionEngine: ExecutionEngine) {}

  async action(params: ComputerAction): Promise<any> {
    this.logger.log(`Executing computer action: ${params.action}`);
    return this.executionEngine.executeAction(params);
  }

  async screenshot(): Promise<{ image: string }> {
    return this.action({ action: 'screenshot' });
  }
}
