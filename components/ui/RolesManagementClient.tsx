"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee } from '@/types/database.types';
import { Search, Shield, Loader2 } from 'lucide-react';

interface Props {
  initialEmployees: Employee[];
}

const ROLE_OPTIONS = [
  '사원', '대리', '과장', '차장', '부장', '팀장', '수석연구원', '선임연구원', '시스템관리자'
];

export default function RolesManagementClient({ initialEmployees }: Props) {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 고유 부서 목록 추출
  const departments = ['All', ...Array.from(new Set(initialEmployees.map(e => e.department).filter(Boolean)))];

  const handleRoleChange = async (employeeId: string, newRole: string, oldRole: string, empName: string) => {
    if (confirm(`[${empName}] 사원의 권한/직급을 '${oldRole}'에서 '${newRole}'(으)로 변경하시겠습니까?`)) {
      setUpdatingId(employeeId);
      try {
        // 1. employees 테이블 업데이트
        const { error } = await supabase
          .from('employees')
          .update({ role_title: newRole })
          .eq('id', employeeId);

        if (error) {
          alert(`권한 변경 중 에러가 발생했습니다: ${error.message}`);
          return;
        }

        // 2. 상태 업데이트
        setEmployees(prev =>
          prev.map(emp => emp.id === employeeId ? { ...emp, role_title: newRole } : emp)
        );

        // 3. 감사 로그 적재
        await supabase
          .from('sync_logs')
          .insert({
            log_type: 'role_management',
            status: 'success',
            message: `[계정 권한 변경] ${empName} 사원의 직무/권한이 '${oldRole}' ➔ '${newRole}'(으)로 수정되었습니다.`
          });

        alert('권한이 성공적으로 수정되었습니다.');
      } catch (err) {
        console.error('Role update error:', err);
        alert('권한 수정 처리 중 오류가 발생했습니다.');
      } finally {
        setUpdatingId(null);
      }
    }
  };

  const handleToggleAdmin = async (emp: Employee) => {
    const isAdmin = emp.role_title === '시스템관리자';
    const newRole = isAdmin ? '사원' : '시스템관리자';
    await handleRoleChange(emp.id, newRole, emp.role_title, emp.name);
  };

  const filteredEmployees = employees.filter(emp => {
    // admin@company.com 계정 자체는 권한 변경 대상에서 제외시킴 (초관리자 보호)
    if (emp.email === 'admin@company.com') return false;

    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDept === 'All' || emp.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* 상단 검색 및 필터 */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="직원 이름, 이메일 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
        >
          <option value="All">모든 부서</option>
          {departments.filter(d => d !== 'All').map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* 권한 관리 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이름</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이메일</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">소속 부서</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">현재 직급/역할</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">관리자 권한</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">권한 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const isAdmin = emp.role_title === '시스템관리자' || emp.role_title.includes('관리자');

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#020617]">
                        {emp.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {emp.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {emp.department || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          isAdmin 
                            ? 'bg-red-50 text-red-600 border border-red-100' 
                            : 'bg-gray-50 text-gray-600 border border-gray-100'
                        }`}>
                          {emp.role_title}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleToggleAdmin(emp)}
                          disabled={updatingId === emp.id}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                            isAdmin
                              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                          }`}
                        >
                          {isAdmin ? '관리자 권한 해제' : '관리자 권한 부여'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <select
                          value={emp.role_title}
                          disabled={updatingId === emp.id}
                          onChange={(e) => handleRoleChange(emp.id, e.target.value, emp.role_title, emp.name)}
                          className="px-2 py-1 rounded border border-gray-200 text-xs bg-white focus:border-[#00cfc1] outline-none"
                        >
                          {ROLE_OPTIONS.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    권한 설정 가능한 임직원 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
