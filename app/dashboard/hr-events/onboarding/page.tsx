"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Asset, SaasService } from '@/types/database.types';
import { UserPlus, CheckCircle, Monitor, Shield, ArrowRight, Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [unassignedAssets, setUnassignedAssets] = useState<Asset[]>([]);
  const [saasServices, setSaasServices] = useState<SaasService[]>([]);
  
  // Selection states
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedSaasIds, setSelectedSaasIds] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Record<string, { default_asset_keyword: string; default_saas_names: string[] }>>({});
  const [templateApplied, setTemplateApplied] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 4개의 비동기 처리를 병렬로 실행하여 패치 속도를 개선합니다.
      const [empResult, assetResult, saasResult, templateResponse] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .eq('status', 'onboarding')
          .order('name'),
        supabase
          .from('assets')
          .select('*')
          .eq('status', 'unassigned'),
        supabase
          .from('saas_services')
          .select('*'),
        fetch('/api/templates')
      ]);

      const empData = empResult.data;
      const assetData = assetResult.data;
      const saasData = saasResult.data;

      setEmployees(empData || []);
      setUnassignedAssets(assetData || []);
      setSaasServices(saasData || []);

      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        setTemplates(templateData);
      }
      
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

  useEffect(() => {
    fetchData();
  }, []);

  // Set default asset and SaaS when selected employee changes (Template dynamic mapping)
  useEffect(() => {
    if (selectedEmployee) {
      const dept = selectedEmployee.department;
      const template = templates[dept];

      if (template) {
        // 1. SaaS 매핑: 템플릿에 명시된 saas_names와 매칭되는 saas 서비스들의 id를 찾아서 세팅
        const defaultSaasNames = template.default_saas_names || [];
        const mappedSaasIds = saasServices
          .filter(s => defaultSaasNames.includes(s.name))
          .map(s => s.id);
        
        setSelectedSaasIds(mappedSaasIds);

        // 2. IT 자산 매핑: 템플릿에 명시된 default_asset_keyword를 포함하는 자산 탐색
        const keyword = template.default_asset_keyword?.toLowerCase();
        if (keyword) {
          const matchedAsset = unassignedAssets.find(asset => 
            asset.name?.toLowerCase().includes(keyword) || 
            asset.manufacturer?.toLowerCase().includes(keyword) ||
            asset.model_name?.toLowerCase().includes(keyword)
          );
          if (matchedAsset) {
            setSelectedAssetId(matchedAsset.id);
          } else {
            setSelectedAssetId('');
          }
        } else {
          setSelectedAssetId('');
        }

        setTemplateApplied(true);
      } else {
        // 템플릿이 없을 경우 기본적으로 수동 설정을 위해 자산 비우고 모든 SaaS 체크 해제
        setSelectedAssetId('');
        setSelectedSaasIds([]);
        setTemplateApplied(false);
      }
    } else {
      setTemplateApplied(false);
    }
  }, [selectedEmployee, saasServices, templates, unassignedAssets]);

  const handleToggleSaas = (saasId: string) => {
    setSelectedSaasIds(prev => 
      prev.includes(saasId) ? prev.filter(id => id !== saasId) : [...prev, saasId]
    );
  };

  const handleApprove = async () => {
    if (!selectedEmployee) return;

    setActionLoading(selectedEmployee.id);
    const empId = selectedEmployee.id;

    try {
      // 1. 임직원 상태를 active로 업데이트
      await supabase
        .from('employees')
        .update({ status: 'active' })
        .eq('id', empId);

      // 2. IT 자산 배정 처리 (자산이 선택된 경우)
      if (selectedAssetId) {
        await supabase
          .from('assets')
          .update({
            status: 'normal',
            assigned_to: empId,
            assigned_at: new Date().toISOString(),
            location: '서울본사 10층' // 기본 사무실 위치 부여
          })
          .eq('id', selectedAssetId);
      }

      // 3. SaaS 계정 생성 및 라이선스 카운트 업데이트
      for (const saasId of selectedSaasIds) {
        const service = saasServices.find(s => s.id === saasId);
        if (service) {
          // SaaS 계정 추가
          await supabase
            .from('saas_accounts')
            .insert({
              employee_id: empId,
              saas_id: saasId,
              email: selectedEmployee.email,
              status: 'active',
              assigned_at: new Date().toISOString()
            });

          // 라이선스 사용량 + 1
          await supabase
            .from('saas_services')
            .update({ used_licenses: (service.used_licenses || 0) + 1 })
            .eq('id', saasId);
        }
      }

      // 4. HR 이벤트가 존재한다면 completed로 업데이트
      await supabase
        .from('hr_events')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('employee_id', empId)
        .eq('event_type', 'onboarding');

      // 5. 동기화 로그 기록
      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'onboarding_approval',
          status: 'success',
          message: `${selectedEmployee.name} 사원의 자원 할당 및 입사 승인 완료 (부서: ${selectedEmployee.department})`,
          details: JSON.stringify({
            employee_id: empId,
            assigned_asset: selectedAssetId || 'none',
            assigned_saas_count: selectedSaasIds.length
          })
        });

      // 성공 메시지 및 데이터 새로고침
      alert(`${selectedEmployee.name} 사원의 자원 할당 및 입사 승인이 완료되었습니다.`);
      setSelectedEmployee(null);
      await fetchData();
    } catch (err) {
      console.error('Onboarding approval error:', err);
      try {
        await supabase
          .from('sync_logs')
          .insert({
            log_type: 'onboarding_approval',
            status: 'error',
            message: `${selectedEmployee?.name || '임직원'} 사원의 입사 승인 중 오류 발생`,
            details: err instanceof Error ? err.message : String(err)
          });
      } catch (logErr) {
        console.error('Failed to write error log:', logErr);
      }
      alert('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">입사 이벤트 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">입사 자원 배부</h1>
        <p className="text-gray-500 mt-2 text-base">신규 입사자의 부서 및 직무에 알맞은 IT 장비와 소프트웨어를 자동 매핑하고 배부를 승인합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 좌측: 입사 대기자 명단 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
            <UserPlus size={20} className="text-[#00cfc1]" />
            입사 대기 명단
            <span className="text-xs bg-[#00cfc1]/10 text-[#020617] px-2 py-0.5 rounded-full font-bold">
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
                      ? 'border-[#00cfc1] bg-[#00cfc1]/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-[#020617] text-sm">{emp.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                      입사대기
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>부서: {emp.department}</p>
                    <p>직무: {emp.role_title}</p>
                    <p>이메일: {emp.email}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                현재 대기 중인 입사자가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 우측: 자원 설정 및 승인 패널 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedEmployee ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-[#020617]">
                    {selectedEmployee.name} 사원 자원 설정
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">부서: {selectedEmployee.department} | 직무: {selectedEmployee.role_title}</p>
                </div>
                {templateApplied ? (
                  <span className="self-start sm:self-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 animate-in fade-in duration-200">
                    부서 템플릿 자동 적용됨 ({selectedEmployee.department})
                  </span>
                ) : (
                  <span className="self-start sm:self-center text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 animate-in fade-in duration-200">
                    설정된 부서 템플릿 없음 (수동 설정)
                  </span>
                )}
              </div>

              {/* IT 자산 매핑 */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Monitor size={18} className="text-[#3B82F6]" />
                  IT 자산 배정 (재고 노트북 중 선택)
                </label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm bg-white"
                >
                  <option value="">-- 배정하지 않음 (대기) --</option>
                  {unassignedAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      [{asset.category}] {asset.name} (S/N: {asset.serial_number}) - {asset.spec || '사양 미기재'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">현재 창고에 보관 중인 배정 가능한 장비 목록입니다.</p>
              </div>

              {/* SaaS 라이선스 매핑 */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Shield size={18} className="text-[#84CC16]" />
                  SaaS 계정 프로비저닝 (자동 생성)
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {saasServices.map((service) => {
                    const isChecked = selectedSaasIds.includes(service.id);
                    const isLimitReached = service.used_licenses >= service.total_licenses;
                    
                    return (
                      <div
                        key={service.id}
                        onClick={() => !isLimitReached && handleToggleSaas(service.id)}
                        className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all duration-200 ${
                          isLimitReached 
                            ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                            : isChecked
                              ? 'border-[#00cfc1] bg-[#00cfc1]/5'
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            disabled={isLimitReached}
                            className="rounded border-gray-300 text-[#00cfc1] focus:ring-[#00cfc1] pointer-events-none"
                          />
                          <div>
                            <p className="text-sm font-bold text-[#020617]">{service.name}</p>
                            <p className="text-xs text-gray-400">
                              사용률: {service.used_licenses} / {service.total_licenses}
                            </p>
                          </div>
                        </div>
                        {isLimitReached && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-semibold">
                            한도 초과
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400">승인 시 해당 SaaS에 직원 회사 이메일 계정이 연동 및 생성됩니다.</p>
              </div>

              {/* 최종 승인 버튼 */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading !== null}
                  className="px-6 py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 text-sm shadow-sm"
                >
                  {actionLoading === selectedEmployee.id ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      승인 처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      자원 배정 및 입사 승인
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white rounded-xl border border-gray-100 border-dashed p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-2">
                <UserPlus size={28} />
              </div>
              <h3 className="text-base font-bold text-[#020617]">선택된 사원이 없습니다</h3>
              <p className="text-sm text-gray-400 max-w-sm">좌측 대기 명단에서 자원을 할당할 임직원을 클릭해 주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
