import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../components/common/PageLoader';

const PartcatalogPage = lazy(() => import('../pages/PartcatalogPage'));
const ItemPage = lazy(() => import('../pages/ItemPage'));
const TermPage = lazy(() => import('../pages/TermPage'));
const AccessDeniedPage = lazy(() => import('../pages/AccessDeniedPage'));
const ProtectedRoute = lazy(() => import('../components/auth/ProtectedRoute'));
const Layout = lazy(() => import('../components/layout/Layout'));

const withSuspense = (element: ReactElement, label?: string) => (
    <Suspense fallback={<PageLoader label={label || 'Loading page...'} />}>
        {element}
    </Suspense>
);

export const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/access-denied" element={withSuspense(<AccessDeniedPage />, 'Loading access page...')} />

            <Route element={withSuspense(<Layout />, 'Loading layout...')}>
                {/* Protected Routes */}
                <Route element={withSuspense(<ProtectedRoute />, 'Checking authorization...')}>
                    <Route path="/" element={withSuspense(<PartcatalogPage />, 'Loading part catalog...')} />
                    <Route path="/search" element={withSuspense(<PartcatalogPage />, 'Loading part catalog...')} />

                    {/* Item Routes */}
                    <Route path="/item/new" element={withSuspense(<ItemPage mode="NEW" />, 'Loading item form...')} />
                    <Route path="/item/:id" element={withSuspense(<ItemPage mode="VIEW" />, 'Loading item...')} />
                    <Route path="/item/:id/edit" element={withSuspense(<ItemPage mode="EDIT" />, 'Loading item...')} />

                    {/* Term Routes */}
                    <Route path="/term/new" element={withSuspense(<TermPage mode="new" />, 'Loading term form...')} />
                    <Route path="/term/:id" element={withSuspense(<TermPage mode="view" />, 'Loading term...')} />
                    <Route path="/term/:id/edit" element={withSuspense(<TermPage mode="edit" />, 'Loading term...')} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};
