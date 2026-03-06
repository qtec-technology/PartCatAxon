import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
    const { user, loading, hasAccess } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-500">Checking authorization...</span>
                </div>
            </div>
        );
    }

    // Auth check: Must be logged in AND have access
    // If not, redirect to Access Denied page
    if (!user || !hasAccess) {
        return <Navigate to="/access-denied" replace />;
    }

    return <Outlet />;
}
