import { User } from 'lucide-react';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import { useAuth } from '../../../auth/AuthContext';

export function HeaderBar() {
    const { user } = useAuth();
    const userName = user?.displayName || 'Guest';

    return (
        <div className="relative h-[50px] z-50 bg-gradient-to-r from-[#2264A0] to-[#1a4f7a] shadow-md">
            <div className="flex items-center justify-between h-full px-4">
                {/* Left: Logo + Title */}
                <div className="flex items-center gap-3">
                    <div className="w-11 h-9 flex items-center justify-center overflow-hidden">
                        <img src="/items/logo_qtec.webp" alt="QTEC" className="h-8 w-8 object-contain" />
                    </div>
                    <h1 className="text-white text-lg font-bold tracking-wide">
                        QTEC AXON SYSTEM
                    </h1>
                </div>

                {/* Right: User Info (Restored to Right with extra spacing) */}
                <div className="flex items-center gap-3 mr-12">
                    <Avatar className="w-8 h-8 border-2 border-white/30 shrink-0">
                        <AvatarFallback className="bg-[#1a4f7a] text-white text-sm">
                            <User className="w-4 h-4" />
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-white text-sm font-medium hidden sm:inline max-w-[200px] truncate" title={userName}>
                        {userName}
                    </span>
                </div>
            </div>
        </div>
    );
}
