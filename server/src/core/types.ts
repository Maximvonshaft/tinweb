export interface RequestUser {
  id: number;
  tenantId: string;
  username: string;
  role: 'ADMIN' | 'USER';
}
