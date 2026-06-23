import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 사용자 성명 및 관리자 여부 확인
  let userName = '시스템 관리자';
  let isAdmin = false;

  if (user.email === 'admin@company.com') {
    isAdmin = true;
  } else {
    const { data: employee } = await supabase
      .from('employees')
      .select('name, role_title')
      .eq('email', user.email)
      .maybeSingle();

    if (employee) {
      userName = employee.name;
      isAdmin = !!(employee.role_title === '시스템관리자' || employee.role_title.includes('관리자'));
    } else {
      userName = user.email?.split('@')[0] || '사용자';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-8 justify-between sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-[#020617]">
            {isAdmin ? '관리자 워크스페이스' : '직원 포털'}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 font-medium">
              <span className="text-[#00cfc1] font-bold">{userName}</span> 님, 오늘도 활기찬 하루 되세요
            </span>
          </div>
        </header>

        <div className="p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}