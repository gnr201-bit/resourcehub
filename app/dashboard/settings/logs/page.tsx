"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SyncLog } from '@/types/database.types';
import { FileText, Search, Loader2, Calendar, Copy, Check } from 'lucide-react';

export default function SyncLogsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyDetails = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false });

      setLogs(data || []);
    } catch (err) {
      console.error('Fetch sync logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.log_type && log.log_type.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = selectedStatus === 'All' || log.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">연동 동기화 로그 데이터를 조회 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">동기화 로그 및 알림</h1>
        <p className="text-gray-500 mt-2 text-base">레거시 HR 연동 및 SaaS 프로비저닝, 자산 배정 등 백엔드에서 발생한 트랜잭션 기록과 동기화 오류 결과를 모니터링합니다.</p>
      </div>

      {/* 검색 및 필터 패널 */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="로그 유형, 메시지 내용 검색..."
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
          <option value="All">모든 결과</option>
          <option value="success">성공 (Success)</option>
          <option value="warning">경고 (Warning)</option>
          <option value="error">오류 (Error)</option>
        </select>
      </div>

      {/* 로그 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">로그 ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">연동 구분</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이력 내용</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">발생 일시</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  let badgeColor = 'bg-gray-100 text-gray-500';
                  if (log.status === 'success') badgeColor = 'bg-emerald-50 text-emerald-600';
                  else if (log.status === 'warning') badgeColor = 'bg-amber-50 text-amber-600';
                  else if (log.status === 'error') badgeColor = 'bg-red-50 text-red-600';

                  let logTypeKo = log.log_type;
                  if (log.log_type === 'sync_hr') logTypeKo = 'HR 동기화';
                  else if (log.log_type === 'saas_provisioning') logTypeKo = 'SaaS 계정 배정';
                  else if (log.log_type === 'saas_deprovisioning') logTypeKo = 'SaaS 계정 회수';
                  else if (log.log_type === 'asset_assignment') logTypeKo = '자산 배정/회수';
                  else if (log.log_type === 'transfer_adjustment') logTypeKo = '부서이동 조정';

                  return (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-gray-400">
                        {log.id.substring(0, 8)}...
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#020617]">
                        {logTypeKo}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{log.message}</div>
                        {log.details && (
                          <div className="text-xs text-gray-400 mt-1 max-w-lg truncate font-mono">
                            {log.details}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400 flex items-center gap-1.5 mt-2">
                        <Calendar size={14} />
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`}>
                          {log.status === 'success' && '성공'}
                          {log.status === 'warning' && '경고'}
                          {log.status === 'error' && '실패'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                    기록된 시스템 연동 동기화 로그가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 동기화 로그 상세 모달 */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
                <FileText className="text-[#00cfc1]" size={20} />
                동기화 감사 로그 상세 내역
              </h3>
              <button 
                onClick={() => {
                  setSelectedLog(null);
                  setCopied(false);
                }} 
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                  <span className="text-gray-400 font-medium">로그 ID</span>
                  <p className="font-mono text-[#020617] font-semibold truncate">{selectedLog.id}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                  <span className="text-gray-400 font-medium">발생 시간</span>
                  <p className="text-[#020617] font-semibold">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                  <span className="text-gray-400 font-medium">연동 구분</span>
                  <p className="text-[#020617] font-semibold">
                    {selectedLog.log_type === 'sync_hr' && 'HR 동기화'}
                    {selectedLog.log_type === 'saas_provisioning' && 'SaaS 계정 배정'}
                    {selectedLog.log_type === 'saas_deprovisioning' && 'SaaS 계정 회수'}
                    {selectedLog.log_type === 'asset_assignment' && '자산 배정/회수'}
                    {selectedLog.log_type === 'transfer_adjustment' && '부서이동 조정'}
                    {!['sync_hr', 'saas_provisioning', 'saas_deprovisioning', 'asset_assignment', 'transfer_adjustment'].includes(selectedLog.log_type || '') && selectedLog.log_type}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                  <span className="text-gray-400 font-medium">처리 상태</span>
                  <div>
                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                      selectedLog.status === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      selectedLog.status === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {selectedLog.status === 'success' && '성공'}
                      {selectedLog.status === 'warning' && '경고'}
                      {selectedLog.status === 'error' && '실패'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-600">이력 메시지</span>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-[#020617] font-semibold leading-relaxed">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.details && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-600">상세 정보 (Details JSON)</span>
                    <button
                      type="button"
                      onClick={() => handleCopyDetails(selectedLog.details || '')}
                      className="text-xs text-[#00cfc1] hover:text-[#00a89a] font-bold flex items-center gap-1"
                    >
                      {copied ? (
                        <>
                          <Check size={12} />
                          복사 완료!
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          클립보드 복사
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 bg-gray-900 text-emerald-400 text-xs font-mono rounded-lg overflow-auto max-h-48 whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        const parsed = JSON.parse(selectedLog.details);
                        return JSON.stringify(parsed, null, 2);
                      } catch {
                        return selectedLog.details;
                      }
                    })()}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLog(null);
                    setCopied(false);
                  }}
                  className="px-5 py-2.5 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
