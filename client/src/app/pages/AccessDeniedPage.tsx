import { useNavigate } from 'react-router-dom';
import { ShieldAlert, User, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../auth/AuthContext';

export default function AccessDeniedPage() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    const handleTryAgain = () => {
        // Redirect to home page as requested
        navigate('/', { replace: true });
        // Alternatively, force a reload if needed: window.location.href = '/';
    };

    if (loading) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            {/* Added border-red-500 and border-2 for the requested red frame */}
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border-2 border-red-500">
                <div className="mb-6 flex justify-center">
                    <div className="bg-red-50 p-4 rounded-full ring-8 ring-red-50/50">
                        <ShieldAlert className="w-16 h-16 text-red-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
                <p className="text-gray-600 mb-8 leading-relaxed">
                    It seems you don't have permission to view this page.
                    <br />
                    Please contact your system administrator if you believe this is a mistake.
                </p>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8 text-left transition-all hover:bg-gray-100/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-2.5 rounded-full shadow-sm border border-gray-100">
                            <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Current User</p>
                            <p className="font-semibold text-gray-900 truncate" title={user?.username}>
                                {user?.displayName || user?.username || 'Guest'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <Button variant="outline" className="w-full justify-center h-10 border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900" onClick={handleTryAgain}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Go to Home Page
                    </Button>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
                        <span>Need help? Contact IT Support</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
