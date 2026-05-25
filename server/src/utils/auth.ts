import type { Request } from 'express';

/**
 * Get the firstname to save as "Updatedby" in the database.
 *
 * Priority:
 *   1. authUser.firstname (from trusted proxy auth headers — preferred)
 *   2. First word of authUser.displayName (fallback)
 *   3. authUser.username (last resort)
 *   4. 'System'
 */
export function resolveUpdatedByFirstName(req: Request): string {
    const firstname = String(req.authUser?.firstname || '').trim();
    if (firstname) {
        return firstname;
    }

    const displayName = String(req.authUser?.displayName || '').trim();
    if (displayName) {
        const [first] = displayName.split(/\s+/);
        if (first) return first;
    }

    const username = String(req.authUser?.username || '').trim();
    if (username) return username;

    return 'System';
}
