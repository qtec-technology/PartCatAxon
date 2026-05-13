'use client';

import { useCallback, useEffect, useState } from 'react';

interface HealthData {
  status: string;
  timestamp: string;
  env: string;
}

interface HealthCheckResult {
  ok: boolean;
  data?: HealthData;
  error?: string;
  latencyMs: number;
}

export default function ApiHealthPage() {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    const start = performance.now();
    try {
      // This call goes through Next.js rewrites → Express /api/health
      const res = await fetch('/api/health', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        setResult({
          ok: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
          latencyMs,
        });
        return;
      }

      const json = await res.json();
      setResult({
        ok: true,
        data: json.data,
        latencyMs,
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs,
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>
        🩺 API Proxy Health Check
      </h1>
      <p style={{ color: 'var(--muted-fg)', fontSize: '0.875rem', marginBottom: 16 }}>
        Tests the Next.js → Express rewrite proxy. If Express is running on port
        3001, this should show <code>status: ok</code>.
      </p>

      <button
        onClick={checkHealth}
        disabled={checking}
        style={{
          padding: '6px 16px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: checking ? 'wait' : 'pointer',
          fontSize: '0.875rem',
          marginBottom: 16,
        }}
      >
        {checking ? 'Checking…' : '🔄 Re-check'}
      </button>

      {result && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            border: `1px solid ${result.ok ? '#22c55e' : '#ef4444'}`,
            background: result.ok
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(239,68,68,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.5rem' }}>{result.ok ? '✅' : '❌'}</span>
            <strong>{result.ok ? 'Proxy Connected' : 'Proxy Failed'}</strong>
            <span style={{ color: 'var(--muted-fg)', fontSize: '0.75rem', marginLeft: 'auto' }}>
              {result.latencyMs}ms
            </span>
          </div>

          {result.ok && result.data && (
            <pre
              style={{
                fontSize: '0.8rem',
                background: 'rgba(0,0,0,0.04)',
                padding: 12,
                borderRadius: 6,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}

          {!result.ok && result.error && (
            <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>
              <strong>Error:</strong> {result.error}
              <p style={{ marginTop: 8, color: 'var(--muted-fg)', fontSize: '0.8rem' }}>
                💡 Make sure Express server is running:{' '}
                <code>cd ../server && npm run dev</code>
              </p>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          padding: 12,
          borderRadius: 6,
          background: 'rgba(0,0,0,0.03)',
          fontSize: '0.8rem',
          color: 'var(--muted-fg)',
        }}
      >
        <strong>How it works:</strong>
        <br />
        <code>GET /api/health</code> → Next.js rewrite →{' '}
        <code>http://localhost:3001/api/health</code> (Express)
      </div>
    </div>
  );
}
