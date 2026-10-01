import { redirect } from 'next/navigation';

// The R8.7 draft lived here while it was compared; it is the home page now.
export default function LandingV3Page() {
  redirect('/');
}
