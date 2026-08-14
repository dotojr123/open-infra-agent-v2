export type Role = 'ADMIN' | 'USER';
export type UserStatus = 'PENDING' | 'APPROVED' | 'BLOCKED';
export type WorkspaceStatus = 'NOT_PROVISIONED' | 'STOPPED' | 'RUNNING' | 'ERROR';

export type User = {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
};

export type Workspace = {
  id: string;
  userId: string;
  desktopContainerId: string | null;
  cockpitContainerId: string | null;
  status: WorkspaceStatus;
  port: number | null;
  lastActiveAt: string | null;
  startedAt: string | null;
  createdAt: string;
};
