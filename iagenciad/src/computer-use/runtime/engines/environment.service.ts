/* eslint-disable */
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EnvironmentDetails } from '../capabilities.types';

export class EnvironmentService {
  async getDetails(): Promise<EnvironmentDetails> {
    const execAsync = promisify(exec);
    const details: EnvironmentDetails = {
      os: os.platform(),
      distro: os.type(),
      arch: os.arch(),
      shell: process.env.SHELL || 'sh',
      path: process.env.PATH || '',
    };

    try {
      const { stdout } = await execAsync('python3 --version', {
        timeout: 2000,
      });
      details.pythonVersion = stdout.trim();
    } catch {}

    try {
      const { stdout } = await execAsync('node --version', { timeout: 2000 });
      details.nodeVersion = stdout.trim();
    } catch {}

    try {
      const { stdout } = await execAsync('git --version', { timeout: 2000 });
      details.gitVersion = stdout.trim();
    } catch {}

    return details;
  }
}
