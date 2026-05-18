import { getDatabase } from '@/lib/actions/database';
import { getPages } from '@/lib/actions/page';
import { notFound } from 'next/navigation';
import DatabaseView from '@/components/features/DatabaseView';

export default async function DatabasePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const db = await getDatabase(params.id);
  
  if (!db) return notFound();

  const pages = await getPages(params.id);

  return (
    <div className="flex-1 overflow-hidden bg-neutral-950 p-8 flex flex-col">
      <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
        <h1 className="text-3xl font-bold mb-8 text-white shrink-0">{db.name}</h1>
        <DatabaseView database={db} initialPages={pages} />
      </div>
    </div>
  );
}
