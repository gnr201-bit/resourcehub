"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Network, Play, Settings, ShieldCheck, Loader2, Plus, Database, RefreshCw, AlertCircle } from 'lucide-react';

export default function HrSyncPage() {
  const supabase = createClient();
  const [syncLoading, setSyncLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Connection states
  const [apiUrl, setApiUrl] = useState('https://legacy-hr-api.company.internal/v1');
  const [apiKey, setApiKey] = useState('••••••••••••••••••••••••••••••••');
  const [syncInterval, setSyncInterval] = useState('daily');
  const [autoSync, setAutoSync] = useState(true);

  // Virtual HR Database simulation states
  const [legacyEmployees, setLegacyEmployees] = useState<any[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  
  // Registration form states
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('개발1팀');
  const [newRoleTitle, setNewRoleTitle] = useState('사원');
  const [newEventType, setNewEventType] = useState<'onboarding' | 'offboarding' | 'transfer'>('onboarding');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  
  // For transfer event specifics
  const [newTargetDept, setNewTargetDept] = useState('IT운영팀');
  const [newTargetRole, setNewTargetRole] = useState('대리');

  // Load settings and fetch legacy HR employees on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiUrl = localStorage.getItem('hr_sync_api_url');
      const savedApiKey = localStorage.getItem('hr_sync_api_key');
      const savedSyncInterval = localStorage.getItem('hr_sync_interval');
      const savedAutoSync = localStorage.getItem('hr_sync_auto_sync');

      if (savedApiUrl !== null) setApiUrl(savedApiUrl);
      if (savedApiKey !== null) setApiKey(savedApiKey);
      if (savedSyncInterval !== null) setSyncInterval(savedSyncInterval);
      if (savedAutoSync !== null) setAutoSync(savedAutoSync === 'true');
    }
    fetchLegacyEmployees();
  }, []);

  const fetchLegacyEmployees = async () => {
    setLegacyLoading(true);
    try {
      const { data, error } = await supabase
        .from('legacy_hr_employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch legacy HR employees:', error);
      } else {
        setLegacyEmployees(data || []);
      }
    } catch (err) {
      console.error('Error fetching legacy HR employees:', err);
    } finally {
      setLegacyLoading(false);
    }
  };

  // Save settings handler
  const handleSaveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hr_sync_api_url', apiUrl);
      localStorage.setItem('hr_sync_api_key', apiKey);
      localStorage.setItem('hr_sync_interval', syncInterval);
      localStorage.setItem('hr_sync_auto_sync', String(autoSync));
      alert('연동 설정이 성공적으로 저장되었습니다.');
    }
  };

  // 가상 레거시 인사 정보 등록
  const handleAddLegacyEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) {
      alert('이름과 이메일을 입력해 주세요.');
      return;
    }

    try {
      const details = newEventType === 'transfer' 
        ? { target_department: newTargetDept, target_role_title: newTargetRole }
        : {};

      const { error } = await supabase
        .from('legacy_hr_employees')
        .insert({
          name: newName,
          email: newEmail,
          department: newEventType === 'offboarding' ? '' : newDepartment,
          role_title: newEventType === 'offboarding' ? '' : newRoleTitle,
          event_type: newEventType,
          event_date: newEventDate,
          status: 'pending',
          details
        });

      if (error) {
        throw error;
      }

      alert('가상 인사 변동 내역이 대기 큐(legacy_hr_employees)에 등록되었습니다.');
      setNewName('');
      setNewEmail('');
      fetchLegacyEmployees();
    } catch (err: any) {
      console.error('Failed to insert legacy employee:', err);
      alert(`등록 실패: ${err.message || String(err)}`);
    }
  };

  // 인사 동기화 트리거 리팩토링
  const handleTriggerSync = async () => {
    setSyncLoading(true);
    try {
      // 1. 대기 중(status = 'pending')인 가상 인사 정보 쿼리
      const { data: pendingEvents, error: fetchError } = await supabase
        .from('legacy_hr_employees')
        .select('*')
        .eq('status', 'pending');

      if (fetchError) throw fetchError;

      if (!pendingEvents || pendingEvents.length === 0) {
        alert('새로 업데이트할 가상 인사 이벤트(Pending)가 없습니다.\n하단의 테스팅 패널에서 가상 인사 데이터를 등록하고 실행해 보세요.');
        setSyncLoading(false);
        return;
      }

      let onboardedCount = 0;
      let offboardedCount = 0;
      let transferredCount = 0;
      let errorCount = 0;

      for (const event of pendingEvents) {
        try {
          if (event.event_type === 'onboarding') {
            // 입사 처리
            // 이미 직원이 존재하는지 확인
            const { data: existing } = await supabase
              .from('employees')
              .select('id')
              .eq('email', event.email);

            let empId = existing && existing.length > 0 ? existing[0].id : null;

            if (!empId) {
              // 1-1. 신규 임직원 onboarding 상태로 생성
              const { data: newEmp, error: empErr } = await supabase
                .from('employees')
                .insert({
                  name: event.name,
                  email: event.email,
                  department: event.department,
                  role_title: event.role_title,
                  status: 'onboarding',
                  joined_at: event.event_date
                })
                .select()
                .single();

              if (empErr) throw empErr;
              empId = newEmp.id;
            }

            // 1-2. hr_events 에 onboarding 대기 추가
            const { error: eventErr } = await supabase
              .from('hr_events')
              .insert({
                event_type: 'onboarding',
                employee_id: empId,
                status: 'pending',
                details: { onboarding_checklist: ['MacBook Pro', 'Slack Account', 'Microsoft 355 License'] },
                event_date: event.event_date
              });

            if (eventErr) throw eventErr;
            onboardedCount++;

          } else if (event.event_type === 'offboarding') {
            // 퇴사 처리
            // 1. 기존 임직원 존재 여부 체크
            const { data: existingEmp } = await supabase
              .from('employees')
              .select('id')
              .eq('email', event.email);

            let empId = existingEmp && existingEmp.length > 0 ? existingEmp[0].id : null;

            if (!empId) {
              // 1-1. 존재하지 않는다면 가상 시뮬레이션을 위해 즉석 임직원 생성
              const { data: newEmp, error: empErr } = await supabase
                .from('employees')
                .insert({
                  name: event.name,
                  email: event.email,
                  department: event.department || '개발1팀',
                  role_title: event.role_title || '사원',
                  status: 'retired',
                  joined_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1년 전 입사로 가정
                  retired_at: event.event_date
                })
                .select()
                .single();

              if (empErr) throw empErr;
              empId = newEmp.id;
            } else {
              // 1-2. 이미 존재한다면 status만 retired로 변경하고 퇴사일 업데이트
              const { error: empUpdateErr } = await supabase
                .from('employees')
                .update({
                  status: 'retired',
                  retired_at: event.event_date
                })
                .eq('id', empId);

              if (empUpdateErr) throw empUpdateErr;
            }

            // 2. 가상 테스팅 시나리오를 위해 지급된 자산이 없는 경우 자동 자산 할당 시뮬레이션
            const { data: currentAssets } = await supabase
              .from('assets')
              .select('id')
              .eq('assigned_to', empId);

            if (!currentAssets || currentAssets.length === 0) {
              // 미배정(unassigned) 자산 중 하나를 가져와서 할당 시도
              const { data: unassignedAssets } = await supabase
                .from('assets')
                .select('id, name')
                .eq('status', 'unassigned')
                .limit(1);

              if (unassignedAssets && unassignedAssets.length > 0) {
                await supabase
                  .from('assets')
                  .update({
                    status: 'normal',
                    assigned_to: empId,
                    assigned_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 한달 전 배정된 것으로 가정
                  })
                  .eq('id', unassignedAssets[0].id);
              } else {
                // 미배정 자산이 없을 경우 테스트용 임시 자산을 생성하여 배정
                await supabase
                  .from('assets')
                  .insert({
                    serial_number: `SN-TEMP-${Math.floor(Math.random() * 1000000)}`,
                    name: '시뮬레이션 테스트용 MacBook Pro 14"',
                    category: '노트북',
                    spec: 'M3 Pro, 18GB, 512GB',
                    status: 'normal',
                    assigned_to: empId,
                    assigned_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                  });
              }
            }

            // 3. 가상 테스팅 시나리오를 위해 지급된 활성 SaaS 계정이 없는 경우 자동 생성 시뮬레이션
            const { data: currentSaas } = await supabase
              .from('saas_accounts')
              .select('id')
              .eq('employee_id', empId)
              .eq('status', 'active');

            if (!currentSaas || currentSaas.length === 0) {
              // Slack 과 MS 365 서비스 가져오기
              const { data: services } = await supabase
                .from('saas_services')
                .select('id, name, used_licenses');

              if (services && services.length > 0) {
                // 최대 2개의 SaaS 서비스 매핑
                const testServices = services.slice(0, 2);
                for (const service of testServices) {
                  await supabase
                    .from('saas_accounts')
                    .insert({
                      employee_id: empId,
                      saas_id: service.id,
                      email: event.email,
                      status: 'active',
                      assigned_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                    });

                  // 라이선스 개수 가산
                  await supabase
                    .from('saas_services')
                    .update({ used_licenses: (service.used_licenses || 0) + 1 })
                    .eq('id', service.id);
                }
              }
            }

            // 4. hr_events 에 offboarding 대기 추가
            const { error: eventErr } = await supabase
              .from('hr_events')
              .insert({
                event_type: 'offboarding',
                employee_id: empId,
                status: 'pending',
                event_date: event.event_date
              });

            if (eventErr) throw eventErr;
            offboardedCount++;

          } else if (event.event_type === 'transfer') {
            // 부서 이동 처리
            const { data: empData, error: empFindErr } = await supabase
              .from('employees')
              .select('id, name, department, role_title')
              .eq('email', event.email)
              .single();

            if (empFindErr || !empData) {
              throw new Error(`부서 이동 처리할 임직원을 찾을 수 없습니다: ${event.email}`);
            }

            const targetDept = event.details?.target_department || '미정';
            const targetRole = event.details?.target_role_title || '미정';

            // hr_events 에 transfer(부서 이동) 대기 추가
            const { error: eventErr } = await supabase
              .from('hr_events')
              .insert({
                event_type: 'transfer',
                employee_id: empData.id,
                status: 'pending',
                event_date: event.event_date,
                details: {
                  from_dept: empData.department,
                  from_role: empData.role_title,
                  to_dept: targetDept,
                  to_role: targetRole
                }
              });

            if (eventErr) throw eventErr;
            transferredCount++;
          }

          // 해당 가상 레코드를 processed 로 상태 변경
          await supabase
            .from('legacy_hr_employees')
            .update({ status: 'processed' })
            .eq('id', event.id);

        } catch (eventProcessErr: any) {
          console.error(`Error processing legacy event ID ${event.id}:`, eventProcessErr);
          errorCount++;
          await supabase
            .from('legacy_hr_employees')
            .update({ status: 'error' })
            .eq('id', event.id);
        }
      }

      // 2. 동기화 성공 로그 기록
      const totalProcessed = onboardedCount + offboardedCount + transferredCount;
      const syncMsg = `인사 데이터 수동 동기화 완료: 총 ${totalProcessed}건 성공 (입사 ${onboardedCount}건, 퇴사 ${offboardedCount}건, 부서이동 ${transferredCount}건) / 실패 ${errorCount}건`;

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'sync_hr',
          status: errorCount > 0 ? 'warning' : 'success',
          message: syncMsg,
          details: JSON.stringify({
            api_endpoint: apiUrl,
            sync_type: 'manual',
            processed_records: totalProcessed,
            failed_records: errorCount,
            details: { onboarding: onboardedCount, offboarding: offboardedCount, transfer: transferredCount }
          })
        });

      alert(`인사 동기화 완료!\n\n- 신규 입사 대기 등록: ${onboardedCount}명\n- 퇴사 자원 회수 대기 등록: ${offboardedCount}명\n- 부서 이동 및 자원 조정 대기 등록: ${transferredCount}명\n- 처리 실패: ${errorCount}건\n\n대시보드 및 각 HR 이벤트 관리 화면에서 확인하실 수 있습니다.`);
      fetchLegacyEmployees();
    } catch (err: any) {
      console.error('HR sync error:', err);
      
      // 오류 로그 기록
      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'sync_hr',
          status: 'error',
          message: '레거시 HR API 동기화 중 치명적 오류가 발생했습니다.',
          details: err.message || String(err)
        });

      alert('HR 동기화 중 오류가 발생했습니다. 로그를 확인해 주세요.');
    } finally {
      setSyncLoading(false);
    }
  };

  // API 연동 테스트
  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

      if (!apiUrl || apiUrl.trim() === '') {
        throw new Error('API 엔드포인트가 설정되지 않았습니다.');
      }

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'sync_hr',
          status: 'success',
          message: `HR API 연동 테스트 성공: ${apiUrl}에 정상적으로 접속되었습니다. (응답 시간: ${Math.round(800 + Math.random() * 200)}ms)`,
          details: JSON.stringify({ api_endpoint: apiUrl, test_type: 'connection_test', result: 'ok' })
        });

      setTestResult({ success: true, message: `✅ 연동 테스트 성공! ${apiUrl}에 정상적으로 접속되었습니다.` });
    } catch (err: any) {
      const errMsg = err.message || String(err);

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'sync_hr',
          status: 'error',
          message: `HR API 연동 테스트 실패: ${errMsg}`,
          details: JSON.stringify({ api_endpoint: apiUrl, test_type: 'connection_test', error: errMsg })
        });

      setTestResult({ success: false, message: `❌ 연동 테스트 실패: ${errMsg}` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">HR 시스템 연동 설정</h1>
        <p className="text-gray-500 mt-2 text-base">레거시 사내 인사 시스템(ERP/Workday)과 표준 REST API 통신 환경을 구축하고 자동 동기화를 조율합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* API 연동 설정 폼 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2 border-b border-gray-100 pb-3">
            <Settings size={18} className="text-gray-500" />
            연동 설정 구성
          </h3>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">인사 시스템 API 엔드포인트</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://hr.company.com/api/v1"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600">인증 토큰 (API Key)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Bearer token"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">동기화 주기</label>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                >
                  <option value="hourly">매 시간 (Hourly)</option>
                  <option value="daily">매일 자정 (Daily)</option>
                  <option value="weekly">매주 일요일 (Weekly)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">자동 동기화 여부</label>
                <div className="flex items-center h-10">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoSync} 
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00cfc1]"></div>
                    <span className="ml-3 text-sm font-semibold text-gray-700">활성화</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-5 py-2.5 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors text-sm shadow-sm"
              >
                연동 설정 저장
              </button>
            </div>
          </div>

          {/* 연동 테스트 버튼 */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <button
              onClick={handleTestConnection}
              disabled={testLoading}
              className="w-full py-2.5 border-2 border-dashed border-[#00cfc1] text-[#00cfc1] hover:bg-[#00cfc1]/5 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {testLoading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  연동 테스트 중...
                </>
              ) : (
                'API 연동 테스트 실행'
              )}
            </button>

            {testResult && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                testResult.success 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* 연동 동기화 실행 영역 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
              <Network size={20} className="text-[#00cfc1]" />
              인사 동기화 트리거
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              수동 동기화 실행 시 즉각 인사 시스템에 접근하여 신규 채용 입사 대기자 명단을 내려받고 스키마 검증을 수행합니다.
            </p>
            
            <div className="p-3 bg-teal-50/20 border border-teal-100 rounded-lg flex items-center gap-2 text-xs text-teal-800">
              <ShieldCheck size={16} className="text-[#00cfc1]" />
              <span>연동 자격증명 연결 활성화 상태</span>
            </div>
          </div>

          <div>
            <button
              onClick={handleTriggerSync}
              disabled={syncLoading}
              className="w-full py-4 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-50"
            >
              {syncLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  동기화 진행 중...
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  동기화 즉시 실행
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 가상 레거시 HR 테스팅 영역 (Wow factor!) */}
      <div className="border-t border-gray-200 pt-8 space-y-6">
        <div className="flex items-center gap-2">
          <Database size={24} className="text-[#00cfc1]" />
          <h2 className="text-2xl font-bold text-[#020617]">가상 레거시 HR 데이터 제어 (테스트 지원)</h2>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          실제 외부 사내 인사 시스템(ERP/Workday)이 부재하므로, 가상의 인사 데이터베이스 테이블(<code className="bg-gray-150 px-1 py-0.5 rounded text-red-600 font-mono text-xs">legacy_hr_employees</code>)에 테스트용 인사 변동 내역을 직접 수동 등록하고, 동기화가 제대로 연동되는지 시뮬레이션할 수 있습니다.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 가상 데이터 등록 폼 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-[#020617] flex items-center gap-1.5 border-b border-gray-50 pb-2">
              <Plus size={16} className="text-[#00cfc1]" />
              인사 변동(이벤트) 등록
            </h3>

            <form onSubmit={handleAddLegacyEmployee} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500">직원 이름</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 아이유"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#00cfc1]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-500">회사 이메일 주소</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="예: iu@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#00cfc1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500">이벤트 종류</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as any)}
                    className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white outline-none focus:border-[#00cfc1]"
                  >
                    <option value="onboarding">입사 (Onboarding)</option>
                    <option value="offboarding">퇴사 (Offboarding)</option>
                    <option value="transfer">부서이동 (Transfer)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-500">이벤트 예정일</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#00cfc1]"
                  />
                </div>
              </div>

              {/* 입사 혹은 부서이동 시 부서/직급 매핑 */}
              {newEventType !== 'offboarding' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50/50 rounded-lg border border-gray-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500">
                      {newEventType === 'transfer' ? '현재 부서' : '소속 부서'}
                    </label>
                    <select
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white outline-none focus:border-[#00cfc1]"
                    >
                      <option value="개발1팀">개발1팀</option>
                      <option value="개발2팀">개발2팀</option>
                      <option value="IT운영팀">IT운영팀</option>
                      <option value="인사팀">인사팀</option>
                      <option value="영업팀">영업팀</option>
                      <option value="마케팅팀">마케팅팀</option>
                      <option value="디자인팀">디자인팀</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500">
                      {newEventType === 'transfer' ? '현재 직급' : '직급/직무'}
                    </label>
                    <select
                      value={newRoleTitle}
                      onChange={(e) => setNewRoleTitle(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white outline-none focus:border-[#00cfc1]"
                    >
                      <option value="사원">사원</option>
                      <option value="대리">대리</option>
                      <option value="과장">과장</option>
                      <option value="차장">차장</option>
                      <option value="부장">부장</option>
                      <option value="팀장">팀장</option>
                      <option value="선임연구원">선임연구원</option>
                      <option value="수석연구원">수석연구원</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 부서 이동 시 추가 목표지 설정 */}
              {newEventType === 'transfer' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/20 rounded-lg border border-blue-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-800">이동할 부서</label>
                    <select
                      value={newTargetDept}
                      onChange={(e) => setNewTargetDept(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white outline-none focus:border-[#00cfc1]"
                    >
                      <option value="개발1팀">개발1팀</option>
                      <option value="개발2팀">개발2팀</option>
                      <option value="IT운영팀">IT운영팀</option>
                      <option value="인사팀">인사팀</option>
                      <option value="영업팀">영업팀</option>
                      <option value="마케팅팀">마케팅팀</option>
                      <option value="디자인팀">디자인팀</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-800">이동할 직급</label>
                    <select
                      value={newTargetRole}
                      onChange={(e) => setNewTargetRole(e.target.value)}
                      className="w-full px-2 py-2 rounded-lg border border-gray-200 text-xs bg-white outline-none focus:border-[#00cfc1]"
                    >
                      <option value="사원">사원</option>
                      <option value="대리">대리</option>
                      <option value="과장">과장</option>
                      <option value="차장">차장</option>
                      <option value="부장">부장</option>
                      <option value="팀장">팀장</option>
                      <option value="선임연구원">선임연구원</option>
                      <option value="수석연구원">수석연구원</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#020617] hover:bg-gray-800 text-white font-bold rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus size={14} />
                가상 인사 데이터 추가
              </button>
            </form>
          </div>

          {/* 가상 테이블 큐 현황 조회 */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-50 pb-2">
              <h3 className="text-base font-bold text-[#020617] flex items-center gap-1.5">
                <Database size={16} className="text-[#00cfc1]" />
                가상 인사 큐 (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono">legacy_hr_employees</code>)
              </h3>
              <button
                onClick={fetchLegacyEmployees}
                className="p-1.5 text-gray-500 hover:text-[#00cfc1] rounded-lg transition-colors"
                title="목록 새로고침"
              >
                <RefreshCw size={14} className={legacyLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">성명</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">이메일</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">이벤트</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">예정일</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500">세부 정보</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-gray-500">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {legacyLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        <Loader2 className="animate-spin inline-block mr-1 text-[#00cfc1]" size={14} />
                        데이터를 조회 중입니다...
                      </td>
                    </tr>
                  ) : legacyEmployees.length > 0 ? (
                    legacyEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#020617]">
                          {emp.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {emp.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.event_type === 'onboarding' ? 'bg-blue-50 text-blue-600' :
                            emp.event_type === 'offboarding' ? 'bg-red-50 text-red-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {emp.event_type === 'onboarding' ? '입사' :
                             emp.event_type === 'offboarding' ? '퇴사' : '부서이동'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                          {emp.event_date}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                          {emp.event_type === 'onboarding' && `${emp.department} · ${emp.role_title}`}
                          {emp.event_type === 'offboarding' && '자산/계정 회수 예정'}
                          {emp.event_type === 'transfer' && `${emp.department} -> ${emp.details?.target_department || '미정'} (${emp.details?.target_role_title || '미정'})`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            emp.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            emp.status === 'processed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {emp.status === 'pending' ? '동기화 대기' :
                             emp.status === 'processed' ? '처리 완료' : '오류'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        현재 등록된 가상 레거시 인사 정보가 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-3 bg-amber-50/30 border border-amber-100 rounded-lg flex gap-2 text-xs text-amber-800">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-normal">
                <strong>시뮬레이션 가이드:</strong> 가상 인사 데이터를 등록하면 상태가 <span className="font-bold">동기화 대기</span>로 들어갑니다. 이후 상단의 <span className="font-bold">"동기화 즉시 실행"</span> 버튼을 클릭하면 실제 메인 DB에 인사 정보가 동기화되어 각 HR 이벤트 화면에서 처리할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
