import { TermPageClient } from '../TermPageClient';

type RouteParams = Promise<{ itemId: string }>;

export default async function TermViewPage({
    params,
}: {
    params: RouteParams;
}) {
    const { itemId } = await params;

    return <TermPageClient initialMode="view" termId={itemId} />;
}
