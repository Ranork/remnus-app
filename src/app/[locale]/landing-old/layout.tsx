import ClientMessages from '@/i18n/ClientMessages';

// Sends this route's client messages on top of the locale layout's (V2 R9.1).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientMessages scope="landing-old">{children}</ClientMessages>;
}
