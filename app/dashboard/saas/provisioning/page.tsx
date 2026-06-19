"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SaasAccount, Employee, SaasService } from '@/types/database.types';
import { UserPlus, ShieldAlert, Check, Shield, Search, Loader2, Sparkles } from 'lucide-react';

export default function SaasProvisioningPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<SaasAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<SaasService[]>([]);

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('All');

  // Provisioning form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedSaasId, setSelectedSaasId] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 3개의 쿼리를 병렬로 실행하여 패치 속도를 개선합니다.
      const [accountsResult, empResult, servicesResult] = await Promise.all([
        supabase
          .from('saas_accounts')
          .select('*, employees(id, name, department), saas_services(id, name, used_licenses)')
          .eq('status', 'active')
          .order('assigned_at', { ascending: false }),
        supabase
          .from('employees')
          .select('*')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('saas_services')
          .select('*')
          .order('name')
      ]);

      const accountsData = accountsResult.data;
      const empData = empResult.data;
      const servicesData = servicesResult.data;

      setAccounts(accountsData as any || []);
      setEmployees(empData || []);
      setServices(servicesData || []);
    } catch (err) {
      console.error('Fetch provisioning data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Prepopulate email field when employee changes
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setAccountEmail(emp.email);
      }
    } else {
      setAccountEmail('');
    }
  }, [selectedEmployeeId, employees]);

  // 수동 계정 프로비저닝 (배정)
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !selectedSaasId || !accountEmail) {
      alert('필수 입력 항목을 채워주세요.');
      return;
    }

    const saas = services.find(s => s.id === selectedSaasId);
    if (saas && saas.used_licenses >= saas.total_licenses) {
      alert('해당 SaaS 서비스의 라이선스 한도가 초과되어 추가 배정이 불가합니다.');
      return;
    }

    setActionLoading('provision');
    try {
      // 1. 이미 존재하는 활성 계정이 있는지 체크
      const { data: existing } = await supabase
        .from('saas_accounts')
        .select('id')
        .eq('employee_id', selectedEmployeeId)
        .eq('saas_id', selectedSaasId)
        .eq('status', 'active');

      if (existing && existing.length > 0) {
        alert('이미 해당 임직원에게 발급된 활성 계정이 존재합니다.');
        setActionLoading(null);
        return;
      }

      // 2. SaaS 계정 추가
      await supabase
        .from('saas_accounts')
        .insert({
          employee_id: selectedEmployeeId,
          saas_id: selectedSaasId,
          email: accountEmail,
          status: 'active',
          assigned_at: new Date().toISOString()
        });

      // 3. SaaS 라이선스 카운트 +1
      if (saas) {
        await supabase
          .from('saas_services')
          .update({
            used_licenses: (saas.used_licenses || 0) + 1
          })
          .eq('id', selectedSaasId);
      }

      // 4. 로그에 기록
      const employee = employees.find(e => e.id === selectedEmployeeId);
      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'saas_provisioning',
          status: 'success',
          message: `SaaS [${saas?.name}] 계정(${accountEmail})이 ${employee?.name} 사원에게 정상 할당되었습니다.`
        });

      alert('성공적으로 SaaS 계정이 프로비저닝 되었습니다.');
      setIsModalOpen(false);
      // 폼 초기화
      setSelectedEmployeeId('');
      setSelectedSaasId('');
      setAccountEmail('');
      await fetchData();
    } catch (err) {
      console.error('Provisioning error:', err);
      alert('프로비저닝 과정에서 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 계정 비활성화 (Deprovisioning)
  const handleRevokeAccount = async (account: SaasAccount) => {
    const confirmRevoke = window.confirm(`[${(account as any).saas_services?.name}] 계정 (${account.email})을 비활성화하시겠습니까?`);
    if (!confirmRevoke) return;

    setActionLoading(account.id);
    const saasId = account.saas_id;
    const currentUsed = (account as any).saas_services?.used_licenses || 0;

    try {
      // 1. SaaS 계정 상태를 'inactive'로 변경
      await supabase
        .from('saas_accounts')
        .update({
          status: 'inactive',
          revoked_at: new Date().toISOString()
        })
        .eq('id', account.id);

      // 2. SaaS 라이선스 사용량 -1
      await supabase
        .from('saas_services')
        .update({
          used_licenses: Math.max(0, currentUsed - 1)
        })
        .eq('id', saasId);

      // 3. 로그에 기록
      const empName = (account as any).employees?.name || '임직원';
      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'saas_deprovisioning',
          status: 'success',
          message: `SaaS [${(account as any).saas_services?.name}] 계정(${account.email})이 ${empName} 사원으로부터 회수되었습니다.`
        });

      alert('계정 회수가 완료되었습니다.');
      await fetchData();
    } catch (err) {
      console.error('Revoke account error:', err);
      alert('계정 회수 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch =
      account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.employees as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesService = selectedService === 'All' || (account as any).saas_services?.id === selectedService;

    return matchesSearch && matchesService;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">SaaS 계정 목록 데이터를 연동 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#020617] tracking-tight">계정 프로비저닝 관리</h1>
          <p className="text-gray-500 mt-2 text-base">각 임직원별로 연동된 SaaS 어카운트 현황을 수동으로 배정(Provision)하거나 차단/회수(Deprovision)합니다.</p>
        </div>
        <div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
          >
            <UserPlus size={18} />
            새 SaaS 계정 할당
          </button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="직원 이름, SaaS 계정 메일 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none"
          />
        </div>

        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
        >
          <option value="All">모든 SaaS 서비스</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* 프로비저닝 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SaaS 솔루션</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">연동 계정 이메일</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">배정 대상자</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">소속 부서</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">발급 일자</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => {
                  const saasName = (account as any).saas_services?.name || 'SaaS';
                  const empName = (account as any).employees?.name || '-';
                  const empDept = (account as any).employees?.department || '-';

                  return (
                    <tr key={account.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#020617]">
                        {saasName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {account.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#020617]">
                        {empName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {empDept}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                        {new Date(account.assigned_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold">
                        <button
                          onClick={() => handleRevokeAccount(account)}
                          disabled={actionLoading === account.id}
                          className="text-[#EF4444] hover:text-red-700 text-xs font-bold disabled:opacity-50"
                        >
                          {actionLoading === account.id ? '처리 중...' : '계정 회수'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    등록된 활성 SaaS 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 새 계정 배정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-1.5">
                <Shield size={20} className="text-[#00cfc1]" />
                새 SaaS 라이선스 배정
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-semibold">✕</button>
            </div>

            <form onSubmit={handleProvision} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">대상 임직원</label>
                <select
                  required
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                >
                  <option value="">-- 임직원을 선택해 주세요 --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department} - {emp.role_title})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">SaaS 솔루션 선택</label>
                <select
                  required
                  value={selectedSaasId}
                  onChange={(e) => setSelectedSaasId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                >
                  <option value="">-- 서비스를 선택해 주세요 --</option>
                  {services.map((saas) => {
                    const isFull = saas.used_licenses >= saas.total_licenses;
                    return (
                      <option key={saas.id} value={saas.id} disabled={isFull}>
                        {saas.name} (잔여 {Math.max(0, saas.total_licenses - saas.used_licenses)}개 / 총 {saas.total_licenses}개) {isFull ? '[한도 초과]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">SaaS 연동 이메일</label>
                <input
                  type="email"
                  required
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'provision'}
                  className="px-4 py-2 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading === 'provision' ? (
                    '발급 중...'
                  ) : (
                    <>
                      <Check size={14} />
                      할당 발급
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
