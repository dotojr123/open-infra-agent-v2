import { ProcessResult } from '../capabilities.types';

export interface ProcessRunnerEngine {
  execute(command: string): Promise<ProcessResult>;
}
