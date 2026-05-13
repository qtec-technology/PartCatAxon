export type ActorType = 'human' | 'service' | 'ai_assistant' | 'scheduled_job';

export type Role =
  | 'catalog_user'
  | 'manager'
  | 'supervisor'
  | 'system_admin'
  | 'ai_reviewer'
  | 'service_operator';

export type Permission =
  | 'catalog.read'
  | 'catalog.write'
  | 'bulk_cost.view'
  | 'bulk_cost.draft'
  | 'bulk_cost.approve'
  | 'agent.diagnose'
  | 'agent.suggest'
  | 'agent.draft'
  | 'agent.execute_safe'
  | 'admin.manage_permissions';

export interface AuthActor {
  id: string;
  displayName: string;
  email?: string;
  actorType: ActorType;
  roles: Role[];
  source: 'static_prototype' | 'future_auth_service' | 'future_database';
}

export interface AuthContext {
  actor: AuthActor;
  permissions: Permission[];
  approvalRequiredFor: Permission[];
  status: 'prototype' | 'ready_for_integration';
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  catalog_user: ['catalog.read', 'bulk_cost.view'],
  manager: [
    'catalog.read',
    'catalog.write',
    'bulk_cost.view',
    'bulk_cost.draft',
    'bulk_cost.approve',
    'agent.diagnose',
    'agent.suggest',
    'agent.draft',
  ],
  supervisor: [
    'catalog.read',
    'catalog.write',
    'bulk_cost.view',
    'bulk_cost.draft',
    'agent.diagnose',
    'agent.suggest',
  ],
  system_admin: [
    'catalog.read',
    'catalog.write',
    'bulk_cost.view',
    'bulk_cost.draft',
    'bulk_cost.approve',
    'agent.diagnose',
    'agent.suggest',
    'agent.draft',
    'agent.execute_safe',
    'admin.manage_permissions',
  ],
  ai_reviewer: ['catalog.read', 'bulk_cost.view', 'agent.diagnose', 'agent.suggest', 'agent.draft'],
  service_operator: ['catalog.read', 'agent.diagnose', 'agent.execute_safe'],
};

export const HUMAN_APPROVAL_REQUIRED: readonly Permission[] = [
  'catalog.write',
  'bulk_cost.approve',
  'agent.execute_safe',
  'admin.manage_permissions',
];

export function resolvePermissions(roles: readonly Role[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))].sort();
}

export function hasPermission(context: AuthContext, permission: Permission): boolean {
  return context.permissions.includes(permission);
}

export function requiresHumanApproval(permission: Permission): boolean {
  return HUMAN_APPROVAL_REQUIRED.includes(permission);
}
