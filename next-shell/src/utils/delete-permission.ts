interface DeletePermissionUser {
    username?: string | null;
    firstname?: string | null;
    displayName?: string | null;
    isManager?: boolean | null;
    isSupervisor?: boolean | null;
}

const normalizeIdentity = (value: string): string => String(value || '').trim().toLowerCase();

export function canDeleteOwnedRecord(updatedBy: string, user?: DeletePermissionUser | null): boolean {
    if (!user) return false;
    if (user.isManager || user.isSupervisor) {
        return true;
    }

    const normalizedOwner = normalizeIdentity(updatedBy);
    if (!normalizedOwner) {
        return false;
    }

    const candidates = new Set<string>();
    const push = (value: string) => {
        const normalized = normalizeIdentity(value);
        if (normalized) {
            candidates.add(normalized);
        }
    };

    push(String(user.username || ''));
    push(String(user.firstname || ''));
    push(String(user.displayName || ''));

    const firstDisplayToken = String(user.displayName || '').trim().split(/\s+/)[0] || '';
    push(firstDisplayToken);

    return candidates.has(normalizedOwner);
}
