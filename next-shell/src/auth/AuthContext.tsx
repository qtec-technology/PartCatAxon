"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { clientLogger } from '../utils/logger';

interface User {
    username: string;
    isAdmin: boolean;
    isUser: boolean;
    isManager: boolean;
    isSupervisor: boolean;
    displayName: string;
    firstname: string;
    lastname: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    hasAccess: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;

        const loadAuthUser = async () => {
            try {
                const res = await fetch('/api/auth/whoami', {
                    credentials: 'include',
                    signal: controller.signal,
                });
                const contentType = res.headers.get('content-type');
                if (!res.ok || !contentType?.includes('application/json')) {
                    throw new Error('Invalid response');
                }

                const payload = await res.json();
                const data = payload?.data || payload;
                const username = String(data.username || 'Guest').trim();
                const adminStatus = data.isAdmin === true || data.isAdmin === 'true';
                const userStatus = data.isUser === true || data.isUser === 'true';
                const managerStatus = data.isManager === true || data.isManager === 'true';
                const supervisorStatus = data.isSupervisor === true || data.isSupervisor === 'true';
                const displayName = String(data.displayName || username).trim();
                const firstname = String(
                    data.firstname || displayName.split(/\s+/)[0] || username
                ).trim();
                const lastname = String(
                    data.lastname || (displayName.split(/\s+/).slice(1).join(' '))
                ).trim();

                if (!mounted) return;

                setUser({
                    username,
                    isAdmin: adminStatus,
                    isUser: userStatus,
                    isManager: managerStatus,
                    isSupervisor: supervisorStatus,
                    displayName,
                    firstname,
                    lastname,
                });
                setIsAdmin(adminStatus);
                setHasAccess(data.hasAccess === true || data.hasAccess === 'true');
            } catch (err) {
                if (controller.signal.aborted || !mounted) return;
                clientLogger.warn('Auth check failed', {
                    error: err instanceof Error ? err.message : String(err),
                });
                setUser(null);
                setHasAccess(false);
                setIsAdmin(false);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        void loadAuthUser();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, hasAccess, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
