import React, { useEffect, useState } from 'react';
import { currentAdmin, signIn, type AdminIdentity } from '../lib/adminApi';

interface AdminGateProps {
  onSignedIn: (admin: AdminIdentity) => void;
}

/**
 * Staff sign-in.
 *
 * The session is an HttpOnly cookie the browser manages, so there is no token
 * held in JavaScript here. Only the caller's own account is affected by a
 * successful sign-in.
 */
export default function AdminGate({ onSignedIn }: AdminGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An existing session should not have to sign in again.
  useEffect(() => {
    let cancelled = false;
    currentAdmin().then((admin) => {
      if (!cancelled && admin) onSignedIn(admin);
    });
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    const result = await signIn(email, password);

    setBusy(false);

    if (!result) {
      setError('Could not reach the service. Start the API with npm run dev --prefix api.');
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPassword('');
    onSignedIn(result.data);
  };

  return (
    <div className="bg-[#ffffff] relative size-full">
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <form onSubmit={submit} className="w-full max-w-[320px] space-y-4">
          <div>
            <h1 className="font-['Newsreader:Medium',_sans-serif] text-[24px] text-[#426b1f] leading-[32px]">
              Staff sign in
            </h1>
            <p className="mt-1 text-[13px] leading-[20px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              Manage the catalogue and stock levels.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@market.ug"
              className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-[16px] font-['Inter:Regular',_sans-serif]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-['Inter:Regular',_sans-serif] text-[#757575]">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full border border-neutral-200 rounded-lg px-4 py-2.5 text-[16px] font-['Inter:Regular',_sans-serif]"
            />
          </div>

          {error && (
            <p className="text-[13px] leading-[19px] font-['Inter:Regular',_sans-serif] text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className={`w-full rounded-lg py-3 text-[15px] font-['Inter:Medium',_sans-serif] text-white ${
              busy || !email || !password ? 'bg-neutral-300 cursor-not-allowed' : 'bg-[#426b1f]'
            }`}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] leading-[16px] font-['Inter:Regular',_sans-serif] text-[#9a9a9a]">
            Accounts are created by an owner with <code>npm run db:seed:admin</code>. There is no
            default account.
          </p>
        </form>
      </div>
    </div>
  );
}