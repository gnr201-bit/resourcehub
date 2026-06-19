"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Asset, SaasAccount } from '@/types/database.types';
import { UserMinus, Check, AlertTriangle, Monitor, Shield, Loader2, Calendar } from 'lucide-react';

export default function OffboardingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Selection state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [assignedAssets, setAssignedAssets] = useState<Asset[]>([]);
  const [saasAccounts, setSaasAccounts] = useState<SaasAccount[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 퇴사 상태인 임직원 조회 (status = 'retired')
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'retired')
        .order('name');

      setEmployees(empData || []);
      
      if (empData && empData.length > 0 && !selectedEmployee) {
        setSelectedEmployee(empData[0]);
      } else if (empData && empData.length === 0) {
        setSelectedEmployee(null);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeResources = async (empId: string) => {
    try {
      // 2개의 쿼리를 병렬로 실행하여 패치 속도를 개선합니다.
      const [assetResult, saasResult] = await Promise.all([
        supabase
          .from('assets')
          .select('*')
          .eq('assigned_to', empId),
        supabase
          .from('saas_accounts')
          .select('*, saas_services!inner(id, name, used_licenses)')
          .eq('employee_id', empId)
          .eq('status', 'active')
      ]);

      const assetData = assetResult.data;
      const saasData = saasResult.data;

      setAssignedAssets(assetData || []);
      setSaasAccounts(saasData as any || []);
    } catch (err) {
      console.error('Resource fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeResources(selectedEmployee.id);
    } else {
      setAssignedAssets([]);
      setSaasAccounts([]);
    }
  }, [selectedEmployee]);

  // 자산 회수 처리
  const handleRecoverAsset = async (assetId: string, assetName: string) => {
    if (!selectedEmployee) return;
    setActionLoading(assetId);
    try {
      // 자산 상태를 'unassigned'로 변경하고 소유주 정보 비우기
      await supabase
        .from('assets')
        .update({
          status: 'unassigned',
          assigned_to: null,
          assigned_at: null,
          location: 'IT자산고' // 회수 후 보관소 위치 설정
        })
        .eq('id', assetId);

      alert(`[${assetName}] 자산 회수 처리가 완료되었습니다.`);
      await fetchEmployeeResources(selectedEmployee.id);
    } catch (err) {
      console.error('Asset recovery error:', err);
      alert('자산 회수 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // SaaS 계정 비활성화 처리
  const handleRevokeSaas = async (accountId: string, saasId: string, saasName: string, currentUsed: number) => {
    if (!selectedEmployee) return;
    setActionLoading(accountId);
    try {
      // 1. SaaS 계정 상태를 'inactive'로 변경
      await supabase
        .from('saas_accounts')
        .update({
          status: 'inactive',
          revoked_at: new Date().toISOString()
        })
        .eq('id', accountId);

      // 2. SaaS 라이선스 사용량 -1 감소
      await supabase
        .from('saas_services')
        .update({
          used_licenses: Math.max(0, currentUsed - 1)
        })
        .eq('id', saasId);

      alert(`[${saasName}] 계정 비활성화 및 라이선스 회수가 완료되었습니다.`);
      await fetchEmployeeResources(selectedEmployee.id);
    } catch (err) {
      console.error('SaaS revoke error:', err);
      alert('SaaS 계정 회수 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 모든 회수가 끝났는지 체크 후 퇴사 종결 처리
  const handleCompleteOffboarding = async () => {
    if (!selectedEmployee) return;
    setActionLoading('complete');
    try {
      // HR 이벤트 상태를 'completed'로 업데이트
      await supabase
        .from('hr_events')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('employee_id', selectedEmployee.id)
        .eq('event_type', 'offboarding');

      alert(`${selectedEmployee.name} 사원의 퇴사 자원 회수 절차가 완전히 종결되었습니다.`);
      setSelectedEmployee(null);
      await fetchData();
    } catch (err) {
      console.error('Complete offboarding error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const isAllCleared = assignedAssets.length === 0 && saasAccounts.length === 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">퇴사 이벤트 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">퇴사 자원 회수</h1>
        <p className="text-gray-500 mt-2 text-base">퇴사 직원의 모든 IT 자산을 회수하고 활성화된 SaaS 계정을 즉시 차단/회수하여 보안 공백을 방지합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 좌측: 퇴사 명단 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
            <UserMinus size={20} className="text-[#EF4444]" />
            퇴사 처리 명단
            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">
              {employees.length}명
            </span>
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {employees.length > 0 ? (
              employees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                    selectedEmployee?.id === emp.id
                      ? 'border-red-400 bg-red-50/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-[#020617] text-sm">{emp.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded font-medium">
                      퇴사대기
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>부서: {emp.department}</p>
                    <p>직무: {emp.role_title}</p>
                    <p className="flex items-center gap-1 text-gray-400">
                      <Calendar size={12} />
                      퇴사일: {emp.retired_at ? new Date(emp.retired_at).toLocaleDateString() : '미정'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                현재 진행 중인 퇴사 회수 건이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 우측: 회수 대상 자원 상세 목록 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedEmployee ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#020617]">
                    {selectedEmployee.name} 사원 회수 현황
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">부서: {selectedEmployee.department} | 직무: {selectedEmployee.role_title}</p>
                </div>

                {isAllCleared && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1">
                    <Check size={14} /> 자원 회수 완료
                  </span>
                )}
              </div>

              {/* IT 자산 회수 영역 */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Monitor size={18} className="text-[#3B82F6]" />
                  반납 대상 IT 자산 ({assignedAssets.length}건)
                </h4>

                <div className="space-y-2">
                  {assignedAssets.length > 0 ? (
                    assignedAssets.map((asset) => (
                      <div 
                        key={asset.id} 
                        className="p-4 border border-gray-100 rounded-xl flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#020617]">{asset.name}</p>
                          <p className="text-xs text-gray-400">S/N: {asset.serial_number} | 사양: {asset.spec || '-'}</p>
                        </div>
                        <button
                          onClick={() => handleRecoverAsset(asset.id, asset.name)}
                          disabled={actionLoading === asset.id}
                          className="px-3 py-1.5 bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionLoading === asset.id ? (
                            <Loader2 className="animate-spin" size={12} />
                          ) : (
                            '회수 처리'
                          )}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-emerald-600 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-xl">
                      반납이 필요한 IT 자산이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* SaaS 계정 회수 영역 */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Shield size={18} className="text-[#84CC16]" />
                  비활성화 대상 SaaS 계정 ({saasAccounts.length}건)
                </h4>

                <div className="space-y-2">
                  {saasAccounts.length > 0 ? (
                    saasAccounts.map((account) => {
                      const saasName = (account as any).saas_services?.name || 'SaaS';
                      const saasId = (account as any).saas_services?.id;
                      const used = (account as any).saas_services?.used_licenses || 0;
                      
                      return (
                        <div 
                          key={account.id} 
                          className="p-4 border border-gray-100 rounded-xl flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#020617]">{saasName}</p>
                            <p className="text-xs text-gray-400">계정 이메일: {account.email}</p>
                          </div>
                          <button
                            onClick={() => handleRevokeSaas(account.id, saasId, saasName, used)}
                            disabled={actionLoading === account.id}
                            className="px-3 py-1.5 bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {actionLoading === account.id ? (
                              <Loader2 className="animate-spin" size={12} />
                            ) : (
                              '계정 회수'
                            )}
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-emerald-600 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-xl">
                      활성 중인 SaaS 연동 계정이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 최종 종결 버튼 */}
              {isAllCleared && (
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={handleCompleteOffboarding}
                    disabled={actionLoading !== null}
                    className="px-6 py-3 bg-[#020617] text-white hover:bg-gray-900 font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
                  >
                    {actionLoading === 'complete' ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      '퇴사 자원 회수 절차 최종 종결'
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full bg-white rounded-xl border border-gray-100 border-dashed p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-2">
                <UserMinus size={28} />
              </div>
              <h3 className="text-base font-bold text-[#020617]">선택된 사원이 없습니다</h3>
              <p className="text-sm text-gray-400 max-w-sm">좌측 퇴사자 명단에서 자원을 반납 처리할 임직원을 클릭해 주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
