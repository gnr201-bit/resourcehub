import React from 'react';
import { createClient, checkAdminOrRedirect } from '@/lib/supabase/server';
import RolesManagementClient from '@/components/ui/RolesManagementClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function SettingsRolesPage() {
  await checkAdminOrRedirect();
  const supabase = await createClient();

  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .order('name');

  if (error) {
    console.error('Fetch employees for roles error:', error);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">계정 권한 설정</h1>
        <p className="text-gray-500 mt-2 text-base">회원가입한 임직원의 시스템 접근 권한 및 직무 등급(역할)을 배부하고 수정합니다.</p>
      </div>

      <RolesManagementClient initialEmployees={employees || []} />
    </div>
  );
}
