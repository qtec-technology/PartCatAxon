import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        alias: {
            '#src/': new URL('./src/', import.meta.url).pathname,
        },
    },
});
