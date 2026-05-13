import type { NextRequest } from 'next/server';

const expressApiUrl = process.env.EXPRESS_API_URL || 'http://localhost:3001';
const csrfOrigin = process.env.EXPRESS_CSRF_ORIGIN || 'http://localhost:3010';
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const hopByHopHeaders = new Set([
  'connection',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function proxyToExpress(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join('/');
  const requestUrl = new URL(request.url);
  const targetUrl = new URL(`/api/${path}${requestUrl.search}`, expressApiUrl);
  const requestHeaders = new Headers(request.headers);

  for (const header of hopByHopHeaders) {
    requestHeaders.delete(header);
  }

  if (mutationMethods.has(request.method)) {
    requestHeaders.set('x-requested-with', 'XMLHttpRequest');
    requestHeaders.set('origin', csrfOrigin);
  }

  const init: RequestInit = {
    method: request.method,
    headers: requestHeaders,
    redirect: 'manual',
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = new Headers(response.headers);

  for (const header of hopByHopHeaders) {
    responseHeaders.delete(header);
  }
  responseHeaders.delete('content-encoding');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyToExpress;
export const HEAD = proxyToExpress;
export const POST = proxyToExpress;
export const PUT = proxyToExpress;
export const PATCH = proxyToExpress;
export const DELETE = proxyToExpress;
