import ClientMessages from '@/i18n/ClientMessages';

// The admin console's client messages on top of the app shell's (V2 R9.1).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="admin">{children}</ClientMessages>;
}
