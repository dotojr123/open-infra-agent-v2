export interface DisplayController {
  screenshot(): Promise<{ image: string }>;
  cursorPosition(): Promise<{ x: number; y: number }>;
  application(
    action:
      | 'desktop'
      | 'firefox'
      | '1password'
      | 'thunderbird'
      | 'vscode'
      | 'terminal'
      | 'directory',
    applicationName: string,
  ): Promise<void>;
}
