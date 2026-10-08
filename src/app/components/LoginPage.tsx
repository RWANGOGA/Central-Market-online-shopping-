import React, { useState } from 'react';
import StatusBar from './shared/StatusBar';
import svgPaths from "../imports/svg-s5y93igtx2";
import { isValidUgandanPhone, normalizeUgandanPhone } from '../lib/uganda';

interface LoginPageProps {
  onBack: () => void;
  onLogin: (customer: { id: number; fullName: string; phone: string }) => void;
  onNavigateToSignup: () => void;
}

export default function LoginPage({ onBack, onLogin, onNavigateToSignup }: LoginPageProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      onLogin(data.data);
    } catch {
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#ffffff] relative size-full select-none">
      <StatusBar />

      <div className="absolute bg-[#ffffff] h-[149px] left-0 right-0 top-0 z-10">
        <div className="absolute border-[0px_0px_1px] border-neutral-200 border-solid inset-0 pointer-events-none shadow-[0px_0px_20px_0px_rgba(0,0,0,0.1)]" />

        <div className="absolute bg-[#ffffff] h-16 left-0 overflow-clip right-0 top-[31px]">
          <div className="absolute bg-[#ffffff] h-[66px] left-0 top-0 w-[393px]" />
          <div
            className="absolute flex flex-col font-['Newsreader:Medium',_sans-serif] font-medium justify-center leading-[0] text-[#426b1f] text-[24px] text-center text-nowrap top-9 tracking-[-0.24px] translate-x-[-50%] translate-y-[-50%]"
            style={{ left: "calc(50% - 0.5px)" }}
          >
            <p className="adjustLetterSpacing block leading-none whitespace-pre text-[24px]">Mu Katale</p>
          </div>
        </div>
      </div>

      <div className="absolute left-0 right-0 top-[149px] bottom-0 overflow-y-auto">
        <div className="px-6 pt-6 pb-10 space-y-6">
          <div>
            <h1 className="font-['Newsreader:Regular',_sans-serif] text-[28px] text-[#000000] leading-tight">
              Welcome back
            </h1>
            <p className="font-['Inter:Regular',_sans-serif] text-[14px] text-[#757575] mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[12px] text-[#757575] block mb-1 font-['Inter:Regular',_sans-serif]">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-[15px]"
                required
              />
            </div>

            <div>
              <label className="text-[12px] text-[#757575] block mb-1 font-['Inter:Regular',_sans-serif]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-[15px]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#426b1f] text-white font-['Inter:Medium',_sans-serif] text-[15px] py-3.5 rounded-xl hover:bg-[#355a19] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={onNavigateToSignup}
              className="text-[#426b1f] font-['Inter:Regular',_sans-serif] text-[14px] hover:underline"
            >
              Don't have an account? Sign up
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={onBack}
              className="text-[#757575] font-['Inter:Regular',_sans-serif] text-[13px] hover:text-[#000000]"
            >
              ← Back to shop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
