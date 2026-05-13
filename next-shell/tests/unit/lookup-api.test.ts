import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetLookupCachesForTests, lookupApi } from '@/services/lookup.api';

describe('lookupApi term form cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetLookupCachesForTests();
  });

  it('does not bind cached term-form lookup requests to a component AbortSignal', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeUndefined();
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const promise = lookupApi.getTermFormLookups({ signal: controller.signal });
    controller.abort();

    if (!resolveFetch) {
      throw new Error('fetch was not called');
    }

    resolveFetch(new Response(JSON.stringify({
      success: true,
      data: {
        vendors: [{ CardCode: 'V001', CardName: 'Alpha Supplier' }],
        orderTerms: [{ Name: 'Exwork' }],
        locations: [],
        subLocations: [],
        currencies: [],
        freightTypes: [],
        salesPersons: [],
        uoms: [],
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(promise).resolves.toMatchObject({
      vendors: [{ cardCode: 'V001', cardName: 'Alpha Supplier' }],
      orderTerms: ['Exwork'],
    });
  });

  it('requests purchase sub locations by AP module and selected term location country', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request) => Promise.resolve(
      new Response(JSON.stringify({
        success: true,
        data: [
          { Code: 'CA-LA', Module: 'AP', Country: 'US', Name: 'Los Angeles', Priority: 1 },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ));

    vi.stubGlobal('fetch', fetchMock);

    const rows = await lookupApi.getSubLocations('AP', 'US');

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/lookups/sub-locations?module=AP&country=US');
    expect(rows).toEqual([
      { code: 'CA-LA', module: 'AP', country: 'US', name: 'Los Angeles', priority: 1 },
    ]);
  });
});
