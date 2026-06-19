"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Asset, SaasAccount } from '@/types/database.types';
import { Monitor, Cloud, User, Building, Mail, Briefcase, Loader2, Calendar } from 'lucide-react';

export default function MyResourcesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [mySaas, setMySaas] = useState<SaasAccount[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMyData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. 현재 로그인 사용자 세션 조회
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.email) {
        setErrorMsg('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
        setLoading(false);
        return;
      }

      // 2. 이메일 매핑으로 임직원 테이블 탐색
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single();

      if (empError || !empData) {
        setErrorMsg(`임직원 기준 데이터베이스에 ${user.email}에 해당하는 프로필이 등록되어 있지 않습니다. 관리자에게 문의하세요.`);
        setLoading(false);
        return;
      }

      setEmployee(empData);
      const empId = empData.id;

      // 3 & 4. 내게 할당된 IT 자산 및 활성 SaaS 계정 조회 병렬 실행
      const [assetResult, saasResult] = await Promise.all([
        supabase
          .from('assets')
          .select('*')
          .eq('assigned_to', empId),
        supabase
          .from('saas_accounts')
          .select('*, saas_services(name)')
          .eq('employee_id', empId)
          .eq('status', 'active')
      ]);

      const assetData = assetResult.data;
      const saasData = saasResult.data;

      setMyAssets(assetData || []);
      setMySaas(saasData as any || []);

    } catch (err) {
      console.error('Fetch my resources exception:', err);
      setErrorMsg('데이터를 처리하는 과정에서 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">개인 할당 자원 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="bg-white rounded-xl border border-red-100 p-8 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-red-50 text-[#EF4444] rounded-full flex items-center justify-center mx-auto">
          <Mail size={24} />
        </div>
        <h3 className="text-base font-bold text-[#020617]">조회 실패</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">내 자원 조회</h1>
        <p className="text-gray-500 mt-2 text-base">본인에게 지급된 하드웨어 자산 및 사용 권한이 부여된 SaaS 계정 상태를 실시간 확인합니다.</p>
      </div>

      {employee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 개인 프로필 정보 카드 */}
          <div className="bg-[#020617] text-white rounded-xl p-6 space-y-6 shadow-md hover:shadow-lg transition-all duration-200">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#00cfc1] rounded-full flex items-center justify-center text-[#020617] font-bold text-lg">
                {employee.name[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold">{employee.name}</h3>
                <span className="text-xs px-2 py-0.5 bg-[#00cfc1]/20 text-[#00cfc1] rounded font-semibold">
                  재직 중
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-800 text-sm text-gray-300">
              <div className="flex items-center gap-3">
                <Building size={16} className="text-[#00cfc1]" />
                <span className="text-gray-400 w-16">부서</span>
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-3">
                <Briefcase size={16} className="text-[#00cfc1]" />
                <span className="text-gray-400 w-16">직무/직급</span>
                <span>{employee.role_title}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-[#00cfc1]" />
                <span className="text-gray-400 w-16">이메일</span>
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-[#00cfc1]" />
                <span className="text-gray-400 w-16">입사일</span>
                <span>{new Date(employee.joined_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* 할당 자산 & SaaS 라이선스 현황 */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* IT 자산 목록 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
                <Monitor size={20} className="text-[#3B82F6]" />
                나에게 할당된 IT 자산
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                  {myAssets.length}대
                </span>
              </h3>

              <div className="space-y-3">
                {myAssets.length > 0 ? (
                  myAssets.map((asset) => (
                    <div 
                      key={asset.id} 
                      className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#020617]">{asset.name}</p>
                        <p className="text-xs text-gray-400">S/N: {asset.serial_number} | 사양: {asset.spec || '-'}</p>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5 md:text-right">
                        <p>수령 위치: {asset.location || '-'}</p>
                        <p className="text-gray-400">배정일: {asset.assigned_at ? new Date(asset.assigned_at).toLocaleDateString() : '-'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    현재 할당된 하드웨어 장비가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* SaaS 계정 목록 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
                <Cloud size={20} className="text-[#84CC16]" />
                사용 중인 SaaS 계정
                <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                  {mySaas.length}개
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySaas.length > 0 ? (
                  mySaas.map((account) => {
                    const saasName = (account as any).saas_services?.name || 'SaaS';
                    return (
                      <div 
                        key={account.id} 
                        className="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#020617]">{saasName}</p>
                          <p className="text-xs text-gray-400">계정: {account.email}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-bold">
                          활성화됨
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-12 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    활성화된 클라우드 연동 계정이 없습니다.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
