"use client";

import React, { useState } from 'react';
import { Lock, UserPlus, LogIn, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('개발1팀');
  const [roleTitle, setRoleTitle] = useState('사원');
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
      router.refresh();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      // 1. Supabase Auth 회원가입
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            department,
            role_title: roleTitle
          }
        }
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // 2. employees 테이블에 프로필 레코드 추가
      if (authData.user) {
        const { error: dbError } = await supabase
          .from('employees')
          .insert({
            name,
            email,
            department,
            role_title: roleTitle,
            status: 'active', // 가입 즉시 대시보드 접근 가능하도록 활성화
            joined_at: new Date().toISOString().split('T')[0]
          });

        if (dbError) {
          setError(`DB 연동 실패: ${dbError.message}`);
          setLoading(false);
          return;
        }

        // 로그인 세션이 즉시 생성되었을 것이므로 바로 대시보드로 진입
        alert('회원가입이 완료되었습니다. 자동으로 로그인하여 대시보드로 이동합니다.');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError('회원가입 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-gray-100 space-y-6 transition-all duration-300">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-[#020617] rounded-xl flex items-center justify-center mb-4 shadow-md">
            {isSignUp ? (
              <UserPlus className="text-[#00cfc1]" size={24} />
            ) : (
              <Lock className="text-[#00cfc1]" size={24} />
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#020617] tracking-tight">Resourcehub</h1>
          <p className="text-sm text-gray-500 mt-2">
            {isSignUp ? '신규 회원가입' : 'HR-자원 통합 관리 플랫폼'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={isSignUp ? handleSignUp : handleLogin}>
          {isSignUp && (
            <>
              {/* 이름 */}
              <div>
                <label className="block text-sm font-semibold text-[#020617] mb-1.5">이름</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm"
                  placeholder="홍길동" 
                />
              </div>

              {/* 부서 선택 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#020617] mb-1.5">소속 부서</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm bg-white"
                  >
                    <option value="개발1팀">개발1팀</option>
                    <option value="개발2팀">개발2팀</option>
                    <option value="인사팀">인사팀</option>
                    <option value="마케팅팀">마케팅팀</option>
                    <option value="영업팀">영업팀</option>
                    <option value="디자인팀">디자인팀</option>
                    <option value="IT운영팀">IT운영팀</option>
                  </select>
                </div>

                {/* 직무 선택 */}
                <div>
                  <label className="block text-sm font-semibold text-[#020617] mb-1.5">직급/직무</label>
                  <select
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm bg-white"
                  >
                    <option value="사원">사원</option>
                    <option value="대리">대리</option>
                    <option value="과장">과장</option>
                    <option value="차장">차장</option>
                    <option value="부장">부장</option>
                    <option value="팀장">팀장</option>
                    <option value="수석연구원">수석연구원</option>
                    <option value="선임연구원">선임연구원</option>
                    <option value="시스템관리자">시스템관리자</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-semibold text-[#020617] mb-1.5">이메일 주소</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm"
              placeholder="name@company.com" 
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-semibold text-[#020617] mb-1.5">비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm"
              placeholder="••••••••" 
            />
          </div>

          {isSignUp && (
            /* 비밀번호 확인 */
            <div>
              <label className="block text-sm font-semibold text-[#020617] mb-1.5">비밀번호 확인</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm"
                placeholder="••••••••" 
              />
            </div>
          )}

          {error && (
            <div className="p-3 text-xs text-[#EF4444] bg-[#EF4444]/10 rounded-lg font-medium">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors focus:ring-4 focus:ring-[#00cfc1]/30 disabled:opacity-50 text-sm shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              '처리 중...'
            ) : isSignUp ? (
              <>
                <UserPlus size={16} />
                가입 완료 및 로그인
              </>
            ) : (
              <>
                <LogIn size={16} />
                로그인
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-gray-100 flex flex-col items-center gap-2">
          <button 
            onClick={toggleMode}
            className="text-sm font-semibold text-[#00cfc1] hover:underline flex items-center gap-1.5"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '신규 회원가입 하러가기'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}