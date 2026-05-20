'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { registerUser } from '@/lib/actions/auth';

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerUser, null);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/logo-square-dark.png"
            alt="Remnus"
            className="w-14 h-14 object-contain rounded-xl mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold text-white tracking-tight">Remnus</h1>
          <p className="text-neutral-400 text-sm mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          {/* Google */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-neutral-800" />
            <span className="text-xs text-neutral-600">or</span>
            <div className="flex-1 border-t border-neutral-800" />
          </div>

          {/* Registration form */}
          <form action={formAction} className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Name <span className="text-neutral-600">(optional)</span></label>
              <input
                name="name"
                type="text"
                autoComplete="name"
                className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-neutral-500 placeholder:text-neutral-600"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-neutral-500 placeholder:text-neutral-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Password</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-neutral-500 placeholder:text-neutral-600"
                placeholder="Min. 8 characters"
              />
            </div>

            {state?.error && (
              <p className="text-xs text-red-400">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              {isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-600 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-neutral-400 hover:text-neutral-200 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}
