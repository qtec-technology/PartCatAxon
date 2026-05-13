import type { AuthActor, AuthContext, Role } from './auth-model';
import { HUMAN_APPROVAL_REQUIRED, resolvePermissions } from './auth-model';

const DEFAULT_ROLES: Role[] = ['manager', 'supervisor', 'ai_reviewer'];

export function getStaticAuthContext(): AuthContext {
  const actor: AuthActor = {
    id: process.env.NEXT_PUBLIC_DEMO_ACTOR_ID || 'kittipat.milawan',
    displayName: process.env.NEXT_PUBLIC_DEMO_DISPLAY_NAME || 'Kittipat Milawan',
    email: process.env.NEXT_PUBLIC_DEMO_EMAIL || 'kittipat.milawan@example.local',
    actorType: 'human',
    roles: DEFAULT_ROLES,
    source: 'static_prototype',
  };

  return {
    actor,
    permissions: resolvePermissions(actor.roles),
    approvalRequiredFor: [...HUMAN_APPROVAL_REQUIRED],
    status: 'prototype',
  };
}
