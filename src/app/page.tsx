import { getWorkspaceItems, getDatabaseByItemId } from '@/lib/actions/workspace';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const items = await getWorkspaceItems();

  if (items.length > 0) {
    const first = items[0];
    if (first.type === 'database' && first.databaseId) {
      redirect(`/db/${first.databaseId}`);
    } else {
      redirect(`/page/${first.id}`);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <img src="/logo-square-dark.png" alt="Remna Logo" className="w-16 h-16 object-contain rounded-xl mx-auto mb-5" />
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Remna</h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Use the sidebar to create your first page or database.
        </p>
      </div>
    </div>
  );
}
