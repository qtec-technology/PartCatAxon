import { TermPageClient } from '../../TermPageClient';

type RouteParams = Promise<{ itemId: string }>;

export default async function TermEditPage({
    params,
}: {
    params: RouteParams;
}) {
    const { itemId } = await params;

    return <TermPageClient initialMode="edit" termId={itemId} />;
}
