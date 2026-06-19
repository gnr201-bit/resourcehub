"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh(); // 세션 업데이트 반영을 위해 새로고침
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-[#020617] rounded-lg flex items-center justify-center mb-4">
            <Lock className="text-[#00cfc1]" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-[#020617]">Resourcehub</h1>
          <p className="text-sm text-gray-500 mt-2">HR-자원 통합 관리 플랫폼</p>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-[#020617] mb-2">이메일</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-colors outline-none"
              placeholder="name@company.com" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#020617] mb-2">비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-colors outline-none"
              placeholder="••••••••" 
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-[#EF4444] bg-[#EF4444]/10 rounded-lg">
              로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-semibold rounded-lg transition-colors focus:ring-4 focus:ring-[#00cfc1]/30 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-gray-500 hover:text-[#00cfc1]">
            비밀번호를 잊으셨나요?
          </a>
        </div>
      </div>
    </div>
  );
}