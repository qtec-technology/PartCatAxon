import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function GET(): Promise<Response> {
  const icon = await readFile(join(process.cwd(), 'public', 'items', 'logo_qtec.webp'));

  return new Response(new Uint8Array(icon), {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=86400',
    },
  });
}
