import { getDatabase } from '@/lib/actions/database';
import { getPages } from '@/lib/actions/page';
import { notFound } from 'next/navigation';
import DatabaseView from '@/components/features/DatabaseView';

export default async function DatabasePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [db, pages] = await Promise.all([
    getDatabase(params.id),
    getPages(params.id),
  ]);
  
  if (!db) return notFound();

  return (
    <div className="flex-1 overflow-hidden bg-neutral-850 flex flex-col">
      <DatabaseView database={db} initialPages={pages} />
    </div>
  );
}
