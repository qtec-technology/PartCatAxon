import { Outlet } from 'react-router-dom';
import { HeaderBar } from '../features/search/HeaderBar';

export default function Layout() {
    return (
        <div className="min-h-screen bg-[#F5F5F5] font-sans text-gray-900">
            <HeaderBar />
            <main className="relative">
                <Outlet />
            </main>
        </div>
    );
}
