import { TermPageClient } from '../TermPageClient';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const firstParam = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

export default async function TermNewPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const resolvedSearchParams = await searchParams;
    const sourceItemId = firstParam(resolvedSearchParams.itemId);

    return <TermPageClient initialMode="new" sourceItemId={sourceItemId} />;
}
