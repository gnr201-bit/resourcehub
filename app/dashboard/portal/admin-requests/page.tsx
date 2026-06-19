"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ResourceRequest } from '@/types/database.types';
import { ClipboardCheck, Check, X, Loader2, Search, FileCheck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AdminRequestsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 반려 모달 상태
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // 자산 지급 모달 상태
  const [completingRequest, setCompletingRequest] = useState<any | null>(null);
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [loadingAssets, setLoadingAssets] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('resource_requests')
        .select('*, employees(id, name, department, role_title, email)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;
      setRequests(data || []);
    } catch (err) {
      console.error('Fetch admin requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  // 승인 처리
  const handleApprove = async (req: any) => {
    setActionLoading(req.id);
    try {
      await supabase
        .from('resource_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString()
        })
        .eq('id', req.id);

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'resource_request',
          status: 'success',
          message: `${req.employees?.name || '임직원'}의 자원 요청 [${req.resource_name}]이(가) 승인되었습니다.`
        });

      alert('요청이 승인되었습니다.');
      await fetchRequests();
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // 반려 처리
  const handleReject = async () => {
    if (!rejectingRequest || !rejectionReason.trim()) {
      alert('반려 사유를 입력해 주세요.');
      return;
    }

    setActionLoading(rejectingRequest.id);
    try {
      await supabase
        .from('resource_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          processed_at: new Date().toISOString()
        })
        .eq('id', rejectingRequest.id);

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'resource_request',
          status: 'warning',
          message: `${rejectingRequest.employees?.name || '임직원'}의 자원 요청 [${rejectingRequest.resource_name}]이(가) 반려되었습니다. 사유: ${rejectionReason}`
        });

      alert('요청이 반려 처리되었습니다.');
      setRejectingRequest(null);
      setRejectionReason('');
      await fetchRequests();
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // 완료 처리 (승인된 요청의 자원 지급 완료)
  const handleComplete = async (req: any) => {
    // 1. 신규 IT 자산 요청일 경우, 지급할 자산(S/N)을 선택해야 함 -> 모달 오픈
    if (req.request_type === 'new_resource' && req.resource_category === 'IT Asset') {
      setLoadingAssets(true);
      setCompletingRequest(req);
      setSelectedAssetId('');
      try {
        const { data } = await supabase
          .from('assets')
          .select('*')
          .eq('status', 'unassigned')
          .order('name');
        setAvailableAssets(data || []);
      } catch (err) {
        console.error('Fetch available assets error:', err);
      } finally {
        setLoadingAssets(false);
      }
      return;
    }

    // 2. 그 외 요청은 즉시 완료 처리 진행
    setActionLoading(req.id);
    try {
      if (req.request_type === 'new_resource' && req.resource_category === 'SaaS') {
        // SaaS 서비스 자동 프로비저닝 매핑
        const { data: saasService } = await supabase
          .from('saas_services')
          .select('*')
          .eq('name', req.resource_name)
          .single();

        if (saasService) {
          // 라이선스 한도 체크
          if (saasService.used_licenses >= saasService.total_licenses) {
            alert(`SaaS [${saasService.name}]의 라이선스 한도가 초과되어 지급 완료가 불가합니다.`);
            setActionLoading(null);
            return;
          }

          // saas_accounts 추가
          await supabase
            .from('saas_accounts')
            .insert({
              employee_id: req.employee_id,
              saas_id: saasService.id,
              email: req.employees?.email || '',
              status: 'active',
              assigned_at: new Date().toISOString()
            });

          // saas_services used_licenses 업데이트
          await supabase
            .from('saas_services')
            .update({ used_licenses: (saasService.used_licenses || 0) + 1 })
            .eq('id', saasService.id);

          await supabase
            .from('sync_logs')
            .insert({
              log_type: 'saas_provisioning',
              status: 'success',
              message: `SaaS [${saasService.name}] 계정이 자원 요청 처리를 통해 ${req.employees?.name || '임직원'}에게 지급 완료되었습니다.`
            });
        }
      } 
      else if (req.request_type === 'return_resource') {
        // 반납 요청 처리
        if (req.resource_category === 'IT Asset') {
          // 기기 S/N 파싱
          const serialMatch = req.resource_name.match(/\(S\/N:\s*([^)]+)\)/);
          const serialNumber = serialMatch ? serialMatch[1].trim() : null;

          if (serialNumber) {
            const { data: asset } = await supabase
              .from('assets')
              .select('*')
              .eq('serial_number', serialNumber)
              .single();

            if (asset) {
              await supabase
                .from('assets')
                .update({
                  assigned_to: null,
                  assigned_at: null,
                  status: 'unassigned',
                  location: 'IT자산고'
                })
                .eq('id', asset.id);

              await supabase
                .from('sync_logs')
                .insert({
                  log_type: 'asset_assignment',
                  status: 'success',
                  message: `자산 [${asset.name}]이(가) 반납 완료 처리되어 IT자산고로 회수되었습니다.`
                });
            }
          }
        } 
        else if (req.resource_category === 'SaaS') {
          // SaaS 서비스명 및 이메일 파싱
          const match = req.resource_name.match(/^([^(]+)\s*\(([^)]+)\)$/);
          if (match) {
            const serviceName = match[1].trim();
            const accountEmail = match[2].trim();

            const { data: saasService } = await supabase
              .from('saas_services')
              .select('*')
              .eq('name', serviceName)
              .single();

            if (saasService) {
              const { data: saasAcc } = await supabase
                .from('saas_accounts')
                .select('*')
                .eq('employee_id', req.employee_id)
                .eq('saas_id', saasService.id)
                .eq('email', accountEmail)
                .eq('status', 'active')
                .single();

              if (saasAcc) {
                await supabase
                  .from('saas_accounts')
                  .update({ status: 'inactive', revoked_at: new Date().toISOString() })
                  .eq('id', saasAcc.id);

                await supabase
                  .from('saas_services')
                  .update({ used_licenses: Math.max(0, (saasService.used_licenses || 0) - 1) })
                  .eq('id', saasService.id);

                await supabase
                  .from('sync_logs')
                  .insert({
                    log_type: 'saas_deprovisioning',
                    status: 'success',
                    message: `SaaS [${saasService.name}] 계정이 반납 완료 처리되어 회수되었습니다.`
                  });
              }
            }
          }
        }
      }

      // 최종 요청 상태를 'completed'로 업데이트
      await supabase
        .from('resource_requests')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', req.id);

      alert('요청이 최종 완료 처리되었습니다.');
      await fetchRequests();
    } catch (err) {
      console.error('Complete error:', err);
      alert('완료 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 신규 IT 자산 지급 확정 처리
  const handleConfirmAssetProvision = async () => {
    if (!completingRequest || !selectedAssetId) {
      alert('지급할 자산을 선택해 주세요.');
      return;
    }

    setActionLoading(completingRequest.id);
    try {
      const req = completingRequest;
      
      // 1. 자산 배정 업데이트
      await supabase
        .from('assets')
        .update({
          assigned_to: req.employee_id,
          assigned_at: new Date().toISOString(),
          status: 'normal',
          location: req.employees?.department ? `${req.employees.department} 사무실` : '서울본사 10층'
        })
        .eq('id', selectedAssetId);

      // 2. 요청 상태 업데이트
      await supabase
        .from('resource_requests')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', req.id);

      // 3. 로그 기록
      const { data: asset } = await supabase
        .from('assets')
        .select('name, serial_number')
        .eq('id', selectedAssetId)
        .single();

      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'asset_assignment',
          status: 'success',
          message: `자산 [${asset?.name}] (S/N: ${asset?.serial_number})이(가) 자원 요청 승인을 통해 ${req.employees?.name || '임직원'}에게 배정 및 지급 완료되었습니다.`
        });

      alert('자산 배정 및 지급이 최종 완료되었습니다.');
      setCompletingRequest(null);
      setSelectedAssetId('');
      await fetchRequests();
    } catch (err) {
      console.error('Confirm asset provision error:', err);
      alert('지급 처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 필터링
  const filteredRequests = requests.filter(req => {
    const matchesSearch =
      req.resource_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.employees?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.employees?.department?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // 상태별 카운트 (요약 카드용)
  const pendingCount = requests.filter(r => statusFilter === 'pending' ? true : r.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { label: '대기 중', color: 'bg-amber-50 text-amber-600', icon: <Clock size={12} /> };
      case 'approved': return { label: '승인됨', color: 'bg-blue-50 text-blue-600', icon: <Check size={12} /> };
      case 'completed': return { label: '지급 완료', color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle2 size={12} /> };
      case 'rejected': return { label: '반려됨', color: 'bg-red-50 text-red-600', icon: <X size={12} /> };
      default: return { label: status, color: 'bg-gray-100 text-gray-500', icon: null };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">자원 요청 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">자원 요청 관리</h1>
        <p className="text-gray-500 mt-2 text-base">직원이 제출한 자원 신청/반납 요청을 확인하고 승인, 반려, 지급 완료 처리를 수행합니다.</p>
      </div>

      {/* 필터 패널 */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="요청자 이름, 부서, 자원명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {['pending', 'approved', 'completed', 'rejected', 'All'].map((status) => {
            const labels: Record<string, string> = { pending: '대기 중', approved: '승인됨', completed: '완료', rejected: '반려', All: '전체' };
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                  statusFilter === status
                    ? 'bg-[#00cfc1]/10 text-[#020617] border-[#00cfc1]'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {labels[status]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 요청 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">요청자 정보</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">요청 유형</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">요청 자원</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">요청 사유</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청일</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => {
                  const badge = getStatusBadge(req.status);
                  return (
                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-bold text-[#020617]">{req.employees?.name || '-'}</div>
                        <div className="text-xs text-gray-400">{req.employees?.department || '-'} · {req.employees?.role_title || '-'}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          req.request_type === 'new_resource'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-orange-50 text-orange-600'
                        }`}>
                          {req.request_type === 'new_resource' ? '신규 신청' : '자원 반납'}
                        </span>
                        <div className="text-xs text-gray-400 mt-0.5">[{req.resource_category}]</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#020617] max-w-[200px] truncate">
                        {req.resource_name}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-[200px]">
                        <div className="truncate">{req.reason || '-'}</div>
                        {req.status === 'rejected' && req.rejection_reason && (
                          <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            반려: {req.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${badge.color}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-400">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1.5 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                              {actionLoading === req.id ? '...' : '승인'}
                            </button>
                            <button
                              onClick={() => { setRejectingRequest(req); setRejectionReason(''); }}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                              반려
                            </button>
                          </div>
                        )}
                        {req.status === 'approved' && (
                          <button
                            onClick={() => handleComplete(req)}
                            disabled={actionLoading === req.id}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                          >
                            <FileCheck size={12} />
                            {actionLoading === req.id ? '...' : '지급 완료'}
                          </button>
                        )}
                        {(req.status === 'completed' || req.status === 'rejected') && (
                          <span className="text-xs text-gray-400">
                            {req.processed_at ? new Date(req.processed_at).toLocaleDateString() : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                    {statusFilter === 'pending' ? '현재 대기 중인 자원 요청이 없습니다.' : '해당 상태의 요청이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 반려 사유 입력 모달 */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-1.5">
                <AlertTriangle size={20} className="text-[#EF4444]" />
                요청 반려 사유 입력
              </h3>
              <button onClick={() => setRejectingRequest(null)} className="text-gray-400 hover:text-gray-600 text-sm font-semibold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400">반려 대상 요청</p>
                <p className="text-sm font-bold text-[#020617]">{rejectingRequest.resource_name}</p>
                <p className="text-xs text-gray-500">요청자: {rejectingRequest.employees?.name} ({rejectingRequest.employees?.department})</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">반려 사유 <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="예: 예산 초과로 인해 현재 추가 배정이 불가합니다."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading === rejectingRequest.id}
                  className="px-4 py-2 bg-[#EF4444] hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading === rejectingRequest.id ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <>
                      <X size={14} />
                      반려 확정
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* IT 자산 지급(배정) 모달 */}
      {completingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-1.5">
                <ClipboardCheck size={20} className="text-[#00cfc1]" />
                지급할 IT 자산 선택
              </h3>
              <button onClick={() => setCompletingRequest(null)} className="text-gray-400 hover:text-gray-600 text-sm font-semibold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400">요청 정보</p>
                <p className="text-sm font-bold text-[#020617]">{completingRequest.resource_name}</p>
                <p className="text-xs text-gray-500">요청자: {completingRequest.employees?.name} ({completingRequest.employees?.department})</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">보유 중인 미배정 자산 목록 <span className="text-red-500">*</span></label>
                {loadingAssets ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                    <Loader2 className="animate-spin" size={14} />
                    자산 목록 로딩 중...
                  </div>
                ) : (
                  <select
                    required
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                  >
                    <option value="">-- 지급할 자산을 선택하세요 --</option>
                    {availableAssets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        [{asset.category}] {asset.name} (S/N: {asset.serial_number}) - {asset.spec || '사양 없음'}
                      </option>
                    ))}
                  </select>
                )}
                {availableAssets.length === 0 && !loadingAssets && (
                  <p className="text-xs text-red-500">현재 지급 가능한 미배정 자산 재고가 없습니다.</p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCompletingRequest(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssetProvision}
                  disabled={actionLoading === completingRequest.id || !selectedAssetId}
                  className="px-4 py-2 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {actionLoading === completingRequest.id ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <>
                      <Check size={14} />
                      지급 완료 확정
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
