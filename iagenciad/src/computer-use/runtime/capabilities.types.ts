export interface RuntimeCapabilities {
  shell: boolean;
  filesystem: boolean;
  keyboard: boolean;
  mouse: boolean;
  clipboard: boolean;
  display: boolean;
  gui: boolean;
  network: boolean;
  python?: boolean;
  node?: boolean;
}

export interface EnvironmentDetails {
  os: string;
  distro: string;
  arch: string;
  shell: string;
  path: string;
  pythonVersion?: string;
  nodeVersion?: string;
  gitVersion?: string;
}

export interface ProcessResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

export interface FileResult {
  success: boolean;
  data?: string;
  name?: string;
  size?: number;
  mediaType?: string;
  message?: string;
}

export interface WriteResult {
  success: boolean;
  message: string;
}
