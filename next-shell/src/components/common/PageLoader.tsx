import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
    label?: string;
    fullScreen?: boolean;
}

export function PageLoader({ label = 'Loading...', fullScreen = false }: PageLoaderProps) {
    return (
        <div
            className={`${fullScreen ? 'min-h-screen' : 'h-full'} flex items-center justify-center bg-[#F5F5F5]`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="flex items-center gap-2 text-[#2264A0]">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium">{label}</span>
            </div>
        </div>
    );
}
