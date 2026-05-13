import { TermPageClient } from '../../TermPageClient';

type RouteParams = Promise<{ itemId: string; termId: string }>;

export default async function TermItemViewPage({
    params,
}: {
    params: RouteParams;
}) {
    const { itemId, termId } = await params;

    return <TermPageClient initialMode="view" termId={termId} sourceItemId={itemId} />;
}
