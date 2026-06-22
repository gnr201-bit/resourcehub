"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Asset, SaasAccount } from '@/types/database.types';
import { UserMinus, Check, AlertTriangle, Monitor, Shield, Loader2, Calendar, CheckCircle } from 'lucide-react';

export default function OffboardingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Tab state: pending (대기) vs completed (회수 완료)
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  
  // Lists
  const [employees, setEmployees] = useState<Employee[]>([]); // pending
  const [completedEmployees, setCompletedEmployees] = useState<Employee[]>([]); // completed
  
  // Selection state
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [assignedAssets, setAssignedAssets] = useState<Asset[]>([]);
  const [saasAccounts, setSaasAccounts] = useState<SaasAccount[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 퇴사 자원 회수가 미완료인 사원과 완료된 사원을 병렬로 조회
      const [pendingResult, completedResult] = await Promise.all([
        supabase
          .from('employees')
          .select('*, hr_events!inner(id, status, event_type, processed_at)')
          .eq('status', 'retired')
          .eq('hr_events.event_type', 'offboarding')
          .neq('hr_events.status', 'completed')
          .order('name'),
        supabase
          .from('employees')
          .select('*, hr_events!inner(id, status, event_type, processed_at)')
          .eq('status', 'retired')
          .eq('hr_events.event_type', 'offboarding')
          .eq('hr_events.status', 'completed')
          .order('name')
      ]);

      const pendingData = pendingResult.data || [];
      const completedData = completedResult.data || [];

      setEmployees(pendingData);
      setCompletedEmployees(completedData);
      
      // 현재 활성화된 탭의 사원 목록 기준 선택 노출 조정
      const currentList = activeTab === 'pending' ? pendingData : completedData;
      
      if (currentList.length > 0) {
        // 이미 선택된 사원이 최신 리스트에 있는지 확인하여 유지하거나 첫 번째 사원 선택
        const stillExists = selectedEmployee && currentList.some((emp: any) => emp.id === selectedEmployee.id);
        if (!stillExists) {
          setSelectedEmployee(currentList[0]);
        }
      } else {
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
      // 회수 완료 탭의 직원은 이미 자산 상태가 unassigned이거나 계정이 inactive일 것이므로, 
      // 이전에 배정되었던 이력을 확인하기 위해 status 조건 없이 조회하거나, 
      // 현재 탭 상태에 맞춰 active인 것만 조회하여 깔끔하게 0개로 표시되도록 연동합니다.
      const [assetResult, saasResult] = await Promise.all([
        supabase
          .from('assets')
          .select('*')
          .eq('assigned_to', empId),
        supabase
          .from('saas_accounts')
          .select('*, saas_services!inner(id, name, used_licenses)')
          .eq('employee_id', empId)
          .eq('status', activeTab === 'pending' ? 'active' : 'inactive') // 대기 탭에선 활성 계정만, 완료 탭에선 회수한 계정 히스토리 조회
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

  // 탭 전환 시 선택된 사원 자동 조율
  useEffect(() => {
    const currentList = activeTab === 'pending' ? employees : completedEmployees;
    if (currentList.length > 0) {
      setSelectedEmployee(currentList[0]);
    } else {
      setSelectedEmployee(null);
    }
  }, [activeTab]);

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
      await supabase
        .from('assets')
        .update({
          status: 'unassigned',
          assigned_to: null,
          assigned_at: null,
          location: 'IT자산고'
        })
        .eq('id', assetId);

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'asset_recovery',
          status: 'success',
          message: `${selectedEmployee.name} 사원 자산 회수 완료 - [${assetName}]`,
          details: `자산 ID: ${assetId}, 보관 장소: IT자산고`
        });

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
      await supabase
        .from('saas_accounts')
        .update({
          status: 'inactive',
          revoked_at: new Date().toISOString()
        })
        .eq('id', accountId);

      await supabase
        .from('saas_services')
        .update({
          used_licenses: Math.max(0, currentUsed - 1)
        })
        .eq('id', saasId);

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'saas_deprovisioning',
          status: 'success',
          message: `${selectedEmployee.name} 사원 SaaS 계정 회수 완료 - [${saasName}] (${selectedEmployee.email})`,
          details: `SaaS ID: ${saasId}, 계정 어카운트 ID: ${accountId}`
        });

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
      const { error: updateErr } = await supabase
        .from('hr_events')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('employee_id', selectedEmployee.id)
        .eq('event_type', 'offboarding');

      if (updateErr) throw updateErr;

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'offboarding_complete',
          status: 'success',
          message: `${selectedEmployee.name} 사원의 퇴사 자원 회수 절차 최종 종결`,
          details: `임직원 ID: ${selectedEmployee.id}`
        });

      alert(`${selectedEmployee.name} 사원의 퇴사 자원 회수 절차가 완전히 종결되었습니다.\n(회수 완료 명단 탭에서 기록 조회가 가능합니다.)`);
      setSelectedEmployee(null);
      await fetchData();
    } catch (err) {
      console.error('Complete offboarding error:', err);
      alert('최종 종결 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const isAllCleared = assignedAssets.length === 0 && saasAccounts.filter((a: any) => a.status === 'active').length === 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">퇴사 이벤트 데이터를 불러오는 중...</p>
      </div>
    );
  }

  const currentList = activeTab === 'pending' ? employees : completedEmployees;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">퇴사 자원 회수</h1>
        <p className="text-gray-500 mt-2 text-base">퇴사 직원의 모든 IT 자산을 회수하고 활성화된 SaaS 계정을 즉시 차단/회수하여 보안 공백을 방지합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 좌측: 퇴사 명단 (대기 / 완료 탭 분류) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          {/* 탭 인터페이스 */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 pb-3 text-center text-sm font-bold border-b-2 transition-all ${
                activeTab === 'pending'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              회수 대기 ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 pb-3 text-center text-sm font-bold border-b-2 transition-all ${
                activeTab === 'completed'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              회수 완료 ({completedEmployees.length})
            </button>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {currentList.length > 0 ? (
              currentList.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                    selectedEmployee?.id === emp.id
                      ? activeTab === 'pending' 
                        ? 'border-red-400 bg-red-50/5 shadow-sm'
                        : 'border-emerald-400 bg-emerald-50/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-[#020617] text-sm">{emp.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      activeTab === 'pending' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {activeTab === 'pending' ? '퇴사대기' : '종결완료'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>부서: {emp.department || '미지정'}</p>
                    <p>직무: {emp.role_title || '미지정'}</p>
                    <p className="flex items-center gap-1 text-gray-400">
                      <Calendar size={12} />
                      {activeTab === 'pending' 
                        ? `퇴사일: ${emp.retired_at ? new Date(emp.retired_at).toLocaleDateString() : '미정'}`
                        : `완료일: ${(emp as any).hr_events?.[0]?.processed_at ? new Date((emp as any).hr_events[0].processed_at).toLocaleDateString() : '미정'}`
                      }
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                {activeTab === 'pending' 
                  ? '현재 진행 중인 퇴사 회수 건이 없습니다.'
                  : '처리 완료된 퇴사 자원 회수 건이 없습니다.'
                }
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
                    {selectedEmployee.name} 사원 회수 현황 {activeTab === 'completed' && '(종결)'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">부서: {selectedEmployee.department || '미지정'} | 직무: {selectedEmployee.role_title || '미지정'}</p>
                </div>

                {activeTab === 'completed' ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                    <CheckCircle size={14} /> 종결 완료됨
                  </span>
                ) : (
                  isAllCleared && (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1">
                      <Check size={14} /> 자원 회수 완료
                    </span>
                  )
                )}
              </div>

              {/* IT 자산 회수 영역 */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Monitor size={18} className="text-[#3B82F6]" />
                  {activeTab === 'pending' ? '반납 대상 IT 자산' : '회수 완료된 IT 자산'} ({assignedAssets.length}건)
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
                          <p className="text-xs text-gray-400">
                            S/N: {asset.serial_number} | 
                            상태: <span className="font-semibold text-gray-600">{asset.status === 'unassigned' ? '회수완료(미배정)' : '지급중'}</span>
                          </p>
                        </div>
                        
                        {activeTab === 'pending' && (
                          <button
                            onClick={() => handleRecoverAsset(asset.id, asset.name)}
                            disabled={actionLoading === asset.id || asset.status === 'unassigned'}
                            className="px-3 py-1.5 bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:bg-emerald-50 disabled:text-emerald-600 disabled:opacity-100"
                          >
                            {actionLoading === asset.id ? (
                              <Loader2 className="animate-spin" size={12} />
                            ) : asset.status === 'unassigned' ? (
                              <>
                                <Check size={12} />
                                회수 완료
                              </>
                            ) : (
                              '회수 처리'
                            )}
                          </button>
                        )}
                        {activeTab === 'completed' && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100/50">
                            반납 완료 (IT자산고 보관)
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-emerald-600 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-xl">
                      반납 대상 IT 자산이 존재하지 않습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* SaaS 계정 회수 영역 */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Shield size={18} className="text-[#84CC16]" />
                  {activeTab === 'pending' ? '비활성화 대상 SaaS 계정' : '비활성화(회수) 완료된 SaaS 계정'} ({saasAccounts.length}건)
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
                          
                          {activeTab === 'pending' && (
                            <button
                              onClick={() => handleRevokeSaas(account.id, saasId, saasName, used)}
                              disabled={actionLoading === account.id || account.status === 'inactive'}
                              className="px-3 py-1.5 bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:bg-emerald-50 disabled:text-emerald-600 disabled:opacity-100"
                            >
                              {actionLoading === account.id ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : account.status === 'inactive' ? (
                                <>
                                  <Check size={12} />
                                  비활성화 완료
                                </>
                              ) : (
                                '계정 회수'
                              )}
                            </button>
                          )}
                          {activeTab === 'completed' && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100/50">
                              비활성화 완료
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-emerald-600 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-xl">
                      비활성화(회수)할 SaaS 연동 계정이 존재하지 않습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 최종 종결 버튼 (대기 탭의 모든 자원이 정리되었을 때만 노출) */}
              {activeTab === 'pending' && isAllCleared && (
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

              {/* 완료 탭 종결 메시지 안내 */}
              {activeTab === 'completed' && (
                <div className="p-4.5 bg-emerald-50/30 border border-emerald-100 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
                  <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">퇴사 자원 회수 절차 완료</p>
                    <p className="text-emerald-600 mt-1">본 임직원은 배정된 모든 IT 장비 반납 및 SaaS 계정 라이선스 차단 처리가 완료되어 최종 종결된 상태입니다.</p>
                  </div>
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
