interface ApiEnvelope<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: unknown;
    error?: string;
}

type RequestJsonInit = Omit<RequestInit, 'body'> & {
    body?: BodyInit | object;
};

const isBodyInit = (value: unknown): value is BodyInit =>
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    typeof value === 'string';

export async function requestJson<T>(url: string, init?: RequestJsonInit): Promise<ApiEnvelope<T>> {
    const headers = new Headers(init?.headers);
    // CSRF protection: required by server for POST/PUT/DELETE
    if (!headers.has('X-Requested-With')) {
        headers.set('X-Requested-With', 'XMLHttpRequest');
    }
    let body: BodyInit | undefined;

    if (init && 'body' in init && init.body !== undefined) {
        if (isBodyInit(init.body)) {
            body = init.body;
        } else {
            body = JSON.stringify(init.body);
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }
        }
    }

    const response = await fetch(url, {
        credentials: 'include',
        ...init,
        body,
        headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJsonResponse = contentType.includes('application/json');
    const payload = isJsonResponse
        ? (await response.json()) as ApiEnvelope<T>
        : null;

    if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Request failed: ${response.status}`);
    }

    if (!payload || payload.success !== true) {
        throw new Error(payload?.error || payload?.message || 'Unexpected API response');
    }

    return payload;
}
