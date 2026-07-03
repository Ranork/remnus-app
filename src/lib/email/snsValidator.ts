// Amazon SNS HTTP(S) notification signature verification (no external package).
// Ported from ScoutForge's snsValidator (axios → fetch, JS → TS).
//
// AWS signs every SNS message with the private key of the X.509 certificate at
// SigningCertURL. Verification:
//   1. Check the SigningCertURL host really is amazonaws.com (SSRF / forged
//      certificate protection).
//   2. Download the certificate (cached ~30 min).
//   3. Build the canonical string-to-sign in the type-specific field order.
//   4. Verify the base64 Signature against the certificate's public key
//      (SignatureVersion 1 → SHA1, 2 → SHA256).

import crypto from 'crypto';

export interface SnsMessage {
  Type?: string;
  MessageId?: string;
  Message?: string;
  Subject?: string;
  Timestamp?: string;
  TopicArn?: string;
  Token?: string;
  SubscribeURL?: string;
  Signature?: string;
  SignatureVersion?: string;
  SigningCertURL?: string;
  [key: string]: unknown;
}

const certCache = new Map<string, { pem: string; fetchedAt: number }>();
const CERT_TTL_MS = 30 * 60 * 1000;

// Signed fields (in order) per message type.
const SIGNABLE_KEYS: Record<string, string[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
};

function isValidCertUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    // sns.<region>.amazonaws.com or sns.<region>.amazonaws.com.cn
    return /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(u.hostname);
  } catch {
    return false;
  }
}

async function getCert(url: string): Promise<string> {
  const cached = certCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CERT_TTL_MS) return cached.pem;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
  const pem = await res.text();
  certCache.set(url, { pem, fetchedAt: Date.now() });
  return pem;
}

function buildStringToSign(msg: SnsMessage): string | null {
  const keys = SIGNABLE_KEYS[msg.Type ?? ''];
  if (!keys) return null;
  let str = '';
  for (const key of keys) {
    const val = msg[key];
    if (val === undefined || val === null) continue;
    str += key + '\n' + val + '\n';
  }
  return str;
}

/** Verified → true. Bad signature / unsupported type / cert error → false. */
export async function verifySnsMessage(msg: SnsMessage | null | undefined): Promise<boolean> {
  try {
    if (!msg || !msg.Type || !msg.Signature || !msg.SigningCertURL) return false;
    if (!isValidCertUrl(msg.SigningCertURL)) {
      console.error('[SNS] rejected — invalid SigningCertURL: ' + msg.SigningCertURL);
      return false;
    }
    const stringToSign = buildStringToSign(msg);
    if (stringToSign == null) return false;

    const pem = await getCert(msg.SigningCertURL);
    const algo = String(msg.SignatureVersion) === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
    const verifier = crypto.createVerify(algo);
    verifier.update(stringToSign, 'utf8');
    return verifier.verify(pem, msg.Signature, 'base64');
  } catch (e) {
    console.error('[SNS] signature verification error: ' + (e instanceof Error ? e.message : e));
    return false;
  }
}
