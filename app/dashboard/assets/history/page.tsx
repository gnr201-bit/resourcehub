"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SyncLog } from '@/types/database.types';
import { History, Download, Search, Loader2, Calendar } from 'lucide-react';

export default function AssetHistoryPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 자산 배정 및 반납 관련 동기화 로그 조회
      const { data } = await supabase
        .from('sync_logs')
        .select('*')
        .in('log_type', ['asset_assignment', 'transfer_adjustment'])
        .order('created_at', { ascending: false });

      setLogs(data || []);
    } catch (err) {
      console.error('Fetch logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // CSV 내보내기 기능
  const exportToCSV = () => {
    if (logs.length === 0) return;

    // CSV Header
    const headers = ['ID', '로그 유형', '상태', '상세 이력 메시지', '일시'];
    
    // CSV Rows
    const rows = filteredLogs.map(log => [
      log.id,
      log.log_type === 'asset_assignment' ? '자산 배정/회수' : '부서이동 자 조정',
      log.status === 'success' ? '성공' : '오류',
      log.message.replace(/"/g, '""'), // Escape quotes
      new Date(log.created_at).toLocaleString()
    ]);

    const csvContent = [
      '\uFEFF' + headers.join(','), // UTF-8 BOM to prevent Korean character corruption
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Asset_History_Log_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || log.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">배정 및 회수 이력 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#020617] tracking-tight">배정 및 회수 이력</h1>
          <p className="text-gray-500 mt-2 text-base">IT 자산의 배정, 반납, 부서 이동 시 발생한 모든 물리적 이력을 추적 보관합니다.</p>
        </div>
        <div>
          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="px-5 py-3 bg-[#020617] text-white hover:bg-gray-900 font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
          >
            <Download size={18} />
            이력 CSV 다운로드
          </button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="이력 로그 메시지 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
        >
          <option value="All">모든 처리 결과</option>
          <option value="success">성공 (Success)</option>
          <option value="error">실패 (Error)</option>
        </select>
      </div>

      {/* 이력 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이벤트 유형</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상세 이력 메시지</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">일시</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">처리 결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#020617]">
                      {log.log_type === 'asset_assignment' ? '자산 배정/회수' : '부서 이동 조정'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-lg">
                      {log.message}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400 flex items-center gap-1.5 mt-2">
                      <Calendar size={14} />
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        log.status === 'success'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {log.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">
                    기록된 배정 및 회수 이력이 없습니다.
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
