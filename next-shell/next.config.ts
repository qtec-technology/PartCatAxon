import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const nextShellRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: nextShellRoot,
  devIndicators: {
    position: 'top-right',
  },
  turbopack: {
    root: nextShellRoot,
    resolveAlias: {
      // Force Turbopack to resolve tailwindcss from next-shell/node_modules
      // even when the outer PartCatalogApp package-lock.json confuses the workspace root.
      tailwindcss: resolve(nextShellRoot, 'node_modules/tailwindcss'),
      'tw-animate-css': resolve(nextShellRoot, 'node_modules/tw-animate-css'),
    },
  },
};

export default nextConfig;
