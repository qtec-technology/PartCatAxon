import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/auth/AuthContext';
import { getStaticAuthContext } from '@/features/auth/static-auth';

export const metadata: Metadata = {
  title: 'QTEC AXON SYSTEM',
  description: 'QTEC Part Catalog and cost intelligence workspace',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const authContext = getStaticAuthContext();

  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell context={authContext}>{children}</AppShell>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
