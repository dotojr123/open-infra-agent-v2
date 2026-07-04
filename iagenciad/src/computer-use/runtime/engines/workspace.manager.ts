import * as fs from 'fs/promises';
import * as path from 'path';

export class WorkspaceManager {
  private sessionRoot: string;

  constructor(private readonly sessionId: string) {
    this.sessionRoot = path.join('/tmp/iagencia/sessions', this.sessionId);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionRoot, { recursive: true });
  }

  async destroy(): Promise<void> {
    await fs
      .rm(this.sessionRoot, { recursive: true, force: true })
      .catch(() => {});
  }

  getSessionRoot(): string {
    return this.sessionRoot;
  }

  resolve(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      // If it's absolute, map it relative to sessionRoot so it stays isolated
      const relative = filePath.replace(/^\/+/, '');
      return path.join(this.sessionRoot, relative);
    }
    return path.join(this.sessionRoot, filePath);
  }
}
