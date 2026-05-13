// ─── Standard API Response ──────────────────────────────────────────────────

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    meta?: {
        total?: number;
        page?: number;
        pageSize?: number;
        totalPages?: number;
    };
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationParams {
    page?: number;
    pageSize?: number;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface AuthUser {
    username: string;
    firstname: string;
    lastname: string;
    displayName: string;
    email: string;
    domain: string;
    isUser: boolean;        // Part Catalog User / authenticated domain user
    isManager: boolean;     // PCAT-Manager
    isSupervisor: boolean;  // PCAT-SuperVisor
}

// ─── Dropdown Option ────────────────────────────────────────────────────────

export interface LookupOption {
    code: string;
    name: string;
    [key: string]: any;    // Allow extra fields (e.g., ZoneRate for Location)
}

// ─── Extend Express Request ─────────────────────────────────────────────────

declare global {
    namespace Express {
        interface Request {
            authUser?: AuthUser;
            correlationId?: string;
        }
    }
}
