import { getStandalonePageByItemId } from '@/lib/actions/workspace';
import { notFound } from 'next/navigation';
import StandalonePageEditor from '@/components/features/StandalonePageEditor';

export default async function StandalonePageRoute(
  props: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await props.params;
  const data = await getStandalonePageByItemId(itemId);
  if (!data || !data.page) return notFound();

  return (
    <div className="flex-1 overflow-auto bg-neutral-950">
      <StandalonePageEditor item={data.item} page={data.page} />
    </div>
  );
}
