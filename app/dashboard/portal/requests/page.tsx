"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, ResourceRequest, Asset, SaasAccount, SaasService } from '@/types/database.types';
import { Send, FileText, Loader2, Sparkles, HelpCircle, Check, AlertCircle, AlertTriangle, RotateCcw } from 'lucide-react';

const renderStepper = (status: string) => {
  const steps = [
    { label: '제출 완료', desc: '접수 완료' },
    { label: '검토 중', desc: '담당자 확인' },
    { label: '승인', desc: '지급 대기' },
    { label: '완료', desc: '지급/반납 완료' }
  ];

  let currentStep = 0;
  let isRejected = status === 'rejected';

  if (status === 'pending') {
    currentStep = 1;
  } else if (status === 'approved') {
    currentStep = 2;
  } else if (status === 'completed') {
    currentStep = 3;
  } else if (status === 'rejected') {
    currentStep = 2;
    steps[2].label = '반려됨';
    steps[2].desc = '신청 반려';
  }

  return (
    <div className="py-4 px-2 bg-gray-50/50 rounded-xl border border-gray-100 mt-1">
      <div className="flex items-center justify-between relative">
        {/* 연결 선 */}
        <div className="absolute left-10 right-10 top-[16px] h-0.5 bg-gray-200 z-0">
          <div 
            className={`h-full transition-all duration-500 ${isRejected ? 'bg-red-300' : 'bg-[#00cfc1]'}`}
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          ></div>
        </div>

        {/* 각 단계 원형 마커 */}
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          
          let circleBg = 'bg-gray-100 text-gray-400 border-gray-200';
          
          if (isCompleted) {
            circleBg = isRejected && idx === 2 ? 'bg-red-500 text-white border-red-500' : 'bg-[#00cfc1] text-[#020617] border-[#00cfc1]';
          } else if (isCurrent) {
            circleBg = isRejected ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-[#020617] text-[#00cfc1] border-[#020617]';
          }

          return (
            <div key={idx} className="flex flex-col items-center z-10 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shadow-sm ${circleBg}`}>
                {isCompleted ? (
                  <Check size={14} />
                ) : isRejected && isCurrent && idx === 2 ? (
                  <AlertCircle size={14} />
                ) : (
                  idx + 1
                )}
              </div>
              <span className={`text-[10px] font-bold mt-1.5 ${isCurrent ? (isRejected ? 'text-red-600' : 'text-[#020617]') : 'text-gray-500'}`}>
                {step.label}
              </span>
              <span className="text-[8px] text-gray-400 mt-0.5">{step.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function RequestsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [requestType, setRequestType] = useState<'new_resource' | 'return_resource'>('new_resource');
  const [resourceCategory, setResourceCategory] = useState<'IT Asset' | 'SaaS' | 'Other'>('IT Asset');
  const [resourceName, setResourceName] = useState('');
  const [reason, setReason] = useState('');

  // 반납 요청용: 본인 할당 자원 목록
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [mySaasAccounts, setMySaasAccounts] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [saasServices, setSaasServices] = useState<SaasService[]>([]);

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setErrorMsg('로그인 세션이 유효하지 않습니다.');
        setLoading(false);
        return;
      }

      // 1. 임직원 프로필 조회
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single();

      if (empError || !empData) {
        setErrorMsg('임직원 정보 조회에 실패했습니다.');
        setLoading(false);
        return;
      }

      setEmployee(empData);

      // 2. 내 신청 리스트 조회
      const { data: reqData } = await supabase
        .from('resource_requests')
        .select('*')
        .eq('employee_id', empData.id)
        .order('created_at', { ascending: false });

      setRequests(reqData || []);

      // 3. 전체 SaaS 서비스 목록 조회
      const { data: saasData } = await supabase
        .from('saas_services')
        .select('*')
        .order('name');
      
      setSaasServices(saasData || []);
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  // 반납 타입 선택 시 본인 할당 자원 목록 로드
  useEffect(() => {
    if (requestType === 'return_resource' && employee) {
      fetchMyResources(employee.id);
    }
  }, [requestType, employee]);

  const fetchMyResources = async (empId: string) => {
    setLoadingResources(true);
    try {
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
      setMyAssets(assetResult.data || []);
      setMySaasAccounts(saasResult.data || []);
    } catch (err) {
      console.error('Fetch my resources error:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (!resourceName) {
      alert('신청할 자원 명칭을 입력해 주세요.');
      return;
    }

    setSubmitLoading(true);
    try {
      const { error } = await supabase
        .from('resource_requests')
        .insert({
          employee_id: employee.id,
          request_type: requestType,
          resource_category: resourceCategory,
          resource_name: resourceName,
          reason: reason || null,
          status: 'pending'
        });

      if (error) {
        alert(`신청 제출 오류: ${error.message}`);
      } else {
        alert('자원 신청서가 성공적으로 관리자에게 제출되었습니다.');
        // 폼 초기화
        setResourceName('');
        setReason('');
        await fetchMyRequests();
      }
    } catch (err) {
      console.error('Submit request error:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">신청 이력 및 사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="bg-white rounded-xl border border-red-100 p-8 text-center max-w-lg mx-auto my-12 shadow-sm">
        <p className="text-sm text-red-500 font-semibold">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">자원 요청 및 반납</h1>
        <p className="text-gray-500 mt-2 text-base">추가 업무 장비, 소프트웨어 라이선스 발급을 신청하거나 현재 사용 중인 자원 반납 절차를 진행합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 좌측: 신규 신청 폼 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2 border-b border-gray-100 pb-3">
            <Send size={18} className="text-[#00cfc1]" />
            자원 신청서 작성
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">요청 유형</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequestType('new_resource')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                    requestType === 'new_resource'
                      ? 'bg-[#00cfc1]/10 text-[#020617] border-[#00cfc1]'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  자원 신청
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('return_resource')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                    requestType === 'return_resource'
                      ? 'bg-[#00cfc1]/10 text-[#020617] border-[#00cfc1]'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  자원 반납
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">자원 카테고리</label>
              <select
                value={resourceCategory}
                onChange={(e) => {
                  setResourceCategory(e.target.value as any);
                  setResourceName('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
              >
                <option value="IT Asset">IT 자산 (하드웨어)</option>
                <option value="SaaS">SaaS 라이선스 (계정 권한)</option>
                <option value="Other">기타 유형자산</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">자원 명칭</label>
              {requestType === 'return_resource' && resourceCategory !== 'Other' ? (
                <>
                  {loadingResources ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                      <Loader2 className="animate-spin" size={14} />
                      할당된 자원 목록을 불러오는 중...
                    </div>
                  ) : (
                    <select
                      required
                      value={resourceName}
                      onChange={(e) => setResourceName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                    >
                      <option value="">-- 반납할 자원을 선택해 주세요 --</option>
                      {resourceCategory === 'IT Asset' && myAssets.map((asset) => (
                        <option key={asset.id} value={`[${asset.category}] ${asset.name} (S/N: ${asset.serial_number})`}>
                          [{asset.category}] {asset.name} (S/N: {asset.serial_number})
                        </option>
                      ))}
                      {resourceCategory === 'SaaS' && mySaasAccounts.map((acc) => (
                        <option key={acc.id} value={`${(acc as any).saas_services?.name || 'SaaS'} (${acc.email})`}>
                          {(acc as any).saas_services?.name || 'SaaS'} ({acc.email})
                        </option>
                      ))}
                    </select>
                  )}
                  {resourceCategory === 'IT Asset' && myAssets.length === 0 && !loadingResources && (
                    <p className="text-[10px] text-gray-400 mt-1">현재 할당된 IT 자산이 없습니다.</p>
                  )}
                  {resourceCategory === 'SaaS' && mySaasAccounts.length === 0 && !loadingResources && (
                    <p className="text-[10px] text-gray-400 mt-1">현재 활성화된 SaaS 계정이 없습니다.</p>
                  )}
                </>
              ) : requestType === 'new_resource' && resourceCategory === 'SaaS' ? (
                <select
                  required
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                >
                  <option value="">-- 신청할 SaaS 서비스를 선택해 주세요 --</option>
                  {saasServices.map((service) => (
                    <option key={service.id} value={service.name}>
                      {service.name} (잔여 {Math.max(0, service.total_licenses - service.used_licenses)}개 / 총 {service.total_licenses}개)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  placeholder={requestType === 'new_resource' 
                    ? '예: 34인치 울트라와이드 모니터, Slack 라이선스'
                    : '반납할 자원명을 직접 입력해 주세요'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">요청 사유</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="업무 수행상 해당 자원이 필요한 사유를 입력해 주세요."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitLoading}
              className="w-full py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-50"
            >
              {submitLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                '신청서 제출'
              )}
            </button>
          </form>
        </div>

        {/* 우측: 나의 신청 이력 및 진행 타임라인 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2 border-b border-gray-100 pb-3">
            <FileText size={18} className="text-[#3B82F6]" />
            자원 신청/반납 처리 현황
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
              {requests.length}건
            </span>
          </h3>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {requests.length > 0 ? (
              requests.map((req) => (
                <div 
                  key={req.id} 
                  className={`p-4 border rounded-xl space-y-3 transition-colors ${
                    req.status === 'pending'
                      ? 'border-gray-200 bg-gray-50/10'
                      : req.status === 'approved' || req.status === 'completed'
                        ? 'border-emerald-100 bg-emerald-50/5'
                        : 'border-red-100 bg-red-50/5'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-2 ${
                        req.request_type === 'new_resource' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'bg-orange-50 text-orange-600'
                      }`}>
                        {req.request_type === 'new_resource' ? '신규신청' : '자원반납'}
                      </span>
                      <span className="text-xs text-gray-400">[{req.resource_category}]</span>
                      <p className="text-sm font-bold text-[#020617] mt-1">{req.resource_name}</p>
                    </div>

                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        req.status === 'pending'
                          ? 'bg-gray-100 text-gray-500'
                          : req.status === 'approved' || req.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                      }`}>
                        {req.status === 'pending' && '대기 중'}
                        {req.status === 'approved' && '승인됨'}
                        {req.status === 'completed' && '지급 완료'}
                        {req.status === 'rejected' && '반려됨'}
                      </span>
                    </div>
                  </div>

                  {/* 진행 단계 타임라인 Stepper */}
                  {renderStepper(req.status)}

                  {req.reason && (
                    <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg">
                      <span className="font-semibold text-gray-600 mr-2">신청 사유:</span>
                      {req.reason}
                    </div>
                  )}

                  {req.status === 'rejected' && req.rejection_reason && (
                    <div className="text-xs text-[#EF4444] bg-red-50/50 p-2.5 rounded-lg border border-red-50 flex items-start gap-1.5">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">반려 사유:</span> {req.rejection_reason}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 flex justify-between items-center pt-2 border-t border-dashed border-gray-100">
                    <span>신청일: {new Date(req.created_at).toLocaleString()}</span>
                    {req.processed_at && (
                      <span>처리완료일: {new Date(req.processed_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                신청하신 자원 이력이 없습니다.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
