import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');

const violations = [];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.ts')) {
            continue;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const hasRelativeFrom = /from\s+['"]\.{1,2}\//.test(line);
            const hasRelativeSideEffectImport = /import\s+['"]\.{1,2}\//.test(line);
            if (hasRelativeFrom || hasRelativeSideEffectImport) {
                violations.push(`${path.relative(projectRoot, fullPath)}:${i + 1}: ${line.trim()}`);
            }
        }
    }
}

walk(srcRoot);

if (violations.length > 0) {
    console.error('Found relative imports in server/src. Use #src/* alias instead:');
    for (const violation of violations) {
        console.error(`- ${violation}`);
    }
    process.exit(1);
}

console.log('Import alias check passed: no relative imports in server/src.');
