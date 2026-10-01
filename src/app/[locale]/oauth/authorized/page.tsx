import { getTranslations } from 'next-intl/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { AlertCircle } from 'lucide-react';
import { AuthScreen, AuthStatus } from '@/components/features/auth/AuthScreen';
import { OAuthSuccessView } from './OAuthSuccessView';

function verifyRedirectSig(url: string, sig: string): boolean {
  try {
    // Fail closed when AUTH_SECRET is missing — never validate against a known
    // fallback key (that would let anyone forge the redirect signature).
    const secret = process.env.AUTH_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(url).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sig, 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

export default async function OAuthAuthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; sig?: string }>;
}) {
  const { to, sig } = await searchParams;
  const t = await getTranslations('OAuthAuthorize');

  const isValid =
    !!to &&
    !!sig &&
    sig.length === 64 && // sha256 hex = 64 chars
    verifyRedirectSig(to, sig);

  return (
    <AuthScreen>
      {isValid ? (
        <OAuthSuccessView
          to={to!}
          successTitle={t('successTitle')}
          successMessage={t('successMessage')}
          successClose={t('successClose')}
        />
      ) : (
        <AuthStatus icon={<AlertCircle />} tone="danger" title={t('errorTitle')}>
          {t('invalidRedirect')}
        </AuthStatus>
      )}
    </AuthScreen>
  );
}
