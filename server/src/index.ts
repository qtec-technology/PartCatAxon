import app from '#src/app.js';
import { env } from '#src/config/env.js';
import { getPool, closePool } from '#src/config/database.js';
import { logger } from '#src/utils/logger.js';

async function main() {
    try {
        logger.info('Starting PartCatalog API server', {
            env: env.NODE_ENV,
            port: env.PORT,
        });

        await getPool();

        app.listen(env.PORT, () => {
            logger.info('PartCatalog API server is ready', {
                env: env.NODE_ENV,
                port: env.PORT,
                dbHost: env.DB_HOST,
            });
        });
    } catch (err) {
        logger.error('Failed to start server', err instanceof Error ? err : undefined);
        process.exit(1);
    }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
    logger.info('Received shutdown signal', { signal });
    try {
        await closePool();
    } catch (err) {
        logger.error('Failed while closing SQL pool during shutdown', err instanceof Error ? err : undefined);
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

void main();
