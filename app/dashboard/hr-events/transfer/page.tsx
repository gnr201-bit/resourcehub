"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Asset } from '@/types/database.types';
import { Users, CheckCircle, Monitor, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

export default function TransferPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // HR Events states
  const [hrEvents, setHrEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [assignedAssets, setAssignedAssets] = useState<Asset[]>([]);

  // New transfer details input (pre-filled from sync event details)
  const [newDepartment, setNewDepartment] = useState('');
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [keepAssets, setKeepAssets] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 대기 중(status = 'pending')인 부서이동(transfer) HR 이벤트 조회
      const { data: eventData, error } = await supabase
        .from('hr_events')
        .select('*, employees!inner(id, name, department, role_title, email)')
        .eq('event_type', 'transfer')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch transfer events:', error);
        setHrEvents([]);
      } else {
        setHrEvents(eventData || []);
      }

      // select default event if exists
      if (eventData && eventData.length > 0) {
        // 현재 선택된 이벤트가 여전히 목록에 있는지 확인
        const stillExists = selectedEvent && eventData.some((e: any) => e.id === selectedEvent.id);
        if (!stillExists) {
          setSelectedEvent(eventData[0]);
        }
      } else {
        setSelectedEvent(null);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async (empId: string) => {
    try {
      const { data: assetData } = await supabase
        .from('assets')
        .select('*')
        .eq('assigned_to', empId);

      setAssignedAssets(assetData || []);

      // 기본적으로 모든 자산을 새 부서에서도 유지하는 것으로 설정
      const assetKeepMap: Record<string, boolean> = {};
      assetData?.forEach(asset => {
        assetKeepMap[asset.id] = true;
      });
      setKeepAssets(assetKeepMap);
    } catch (err) {
      console.error('Asset fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      const emp = selectedEvent.employees;
      fetchAssets(emp.id);

      // 동기화된 이벤트 세부 정보를 가져와 프리필(pre-fill)
      setNewDepartment(selectedEvent.details?.to_dept || '');
      setNewRoleTitle(selectedEvent.details?.to_role || '');
    } else {
      setAssignedAssets([]);
      setNewDepartment('');
      setNewRoleTitle('');
    }
  }, [selectedEvent]);

  const handleToggleKeepAsset = (assetId: string) => {
    setKeepAssets(prev => ({ ...prev, [assetId]: !prev[assetId] }));
  };

  const handleProcessTransfer = async () => {
    if (!selectedEvent || !newDepartment || !newRoleTitle) {
      alert('새 부서와 직무 정보를 입력해 주세요.');
      return;
    }

    const emp = selectedEvent.employees;
    setActionLoading(selectedEvent.id);

    try {
      // 1. 임직원의 부서 및 직급 정보 업데이트
      await supabase
        .from('employees')
        .update({
          department: newDepartment,
          role_title: newRoleTitle
        })
        .eq('id', emp.id);

      // 2. 선택 해제된 자산 회수 처리 및 유지된 자산의 위치 정보 변경
      for (const asset of assignedAssets) {
        const isKept = keepAssets[asset.id];
        if (!isKept) {
          // 회수 처리 (unassigned 상태로 복구)
          await supabase
            .from('assets')
            .update({
              status: 'unassigned',
              assigned_to: null,
              assigned_at: null,
              location: 'IT자산고'
            })
            .eq('id', asset.id);
        } else {
          // 부서 이동에 따라 위치 정보만 새 부서 근처로 변경
          await supabase
            .from('assets')
            .update({
              location: `${newDepartment} 사무실`
            })
            .eq('id', asset.id);
        }
      }

      // 3. HR 이벤트 상태를 'completed'로 업데이트
      await supabase
        .from('hr_events')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', selectedEvent.id);

      // 4. 동기화 로그 기록
      await supabase
        .from('sync_logs')
        .insert({
          log_type: 'transfer_adjustment',
          status: 'success',
          message: `${emp.name} 사원의 부서 이동 및 자원 조정 처리 완료 (${emp.department} -> ${newDepartment})`,
          details: `임직원 ID: ${emp.id}, 이벤트 ID: ${selectedEvent.id}`
        });

      alert(`${emp.name} 사원의 부서 이동 및 자원 조정 처리가 승인/완료되었습니다.`);
      setSelectedEvent(null);
      await fetchData();
    } catch (err: any) {
      console.error('Transfer processing error:', err);
      alert(`부서 이동 처리 중 오류가 발생했습니다: ${err.message || String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">인사 이동 이벤트 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">부서 이동 자원관리</h1>
        <p className="text-gray-500 mt-2 text-base">직원의 부서 이동 또는 정기 인사에 따라 직급 및 부서에 맞게 기존 지급 장비를 회수하거나 새로운 표준 자원으로 지원 및 할당합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 좌측: 부서 이동 대기 명단 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
            <Users size={20} className="text-[#00cfc1]" />
            인사 이동 대기 명단
            <span className="text-xs bg-[#00cfc1]/10 text-[#020617] px-2 py-0.5 rounded-full font-bold">
              {hrEvents.length}명
            </span>
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {hrEvents.length > 0 ? (
              hrEvents.map((event) => {
                const emp = event.employees;
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${selectedEvent?.id === event.id
                      ? 'border-[#00cfc1] bg-[#00cfc1]/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    <p className="font-bold text-[#020617] text-sm">{emp.name}</p>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <p className="flex items-center gap-1">
                        <span className="text-gray-400">현재:</span>
                        <span>{emp.department} · {emp.role_title}</span>
                      </p>
                      <p className="flex items-center gap-1 text-blue-600 font-semibold">
                        <ArrowRight size={12} />
                        <span>이동: {event.details?.to_dept || '미정'} · {event.details?.to_role || '미정'}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                대기 중인 인사 이동(부서이동) 건이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 우측: 부서 이동 설정 폼 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedEvent ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold text-[#020617]">
                  {selectedEvent.employees.name} 사원 부서 이동 처리
                </h3>
                <p className="text-xs text-gray-400 mt-1">현재: {selectedEvent.employees.department} ({selectedEvent.employees.role_title})</p>
              </div>

              {/* 새 부서 및 직무 입력 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#020617]">이동할 부서</label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="예: 개발2팀, 경영기획팀"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#020617]">이동 후 직무/직급</label>
                  <input
                    type="text"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    placeholder="예: 팀원, 책임연구원"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm"
                  />
                </div>
              </div>

              {/* 자산 유지/반납 선택 */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Monitor size={18} className="text-[#3B82F6]" />
                  현재 배정된 자산 처리 방식 선택 ({assignedAssets.length}개)
                </label>

                <div className="space-y-2">
                  {assignedAssets.length > 0 ? (
                    assignedAssets.map((asset) => {
                      const isKept = keepAssets[asset.id] ?? true;
                      return (
                        <div
                          key={asset.id}
                          className="p-4 border border-gray-100 rounded-xl flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#020617]">{asset.name}</p>
                            <p className="text-xs text-gray-400">S/N: {asset.serial_number} | 현재 위치: {asset.location || '-'}</p>
                          </div>

                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => handleToggleKeepAsset(asset.id)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${isKept
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                                }`}
                            >
                              {isKept ? '새 부서로 유지' : '기존 부서 반납'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                      현재 배정된 IT 자산이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 완료 버튼 */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={handleProcessTransfer}
                  disabled={actionLoading !== null}
                  className="px-6 py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
                >
                  {actionLoading === selectedEvent.id ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      부서 이동 및 자원 조정 완료
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white rounded-xl border border-gray-100 border-dashed p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-2">
                <RefreshCw size={28} />
              </div>
              <h3 className="text-base font-bold text-[#020617]">선택된 사원이 없습니다</h3>
              <p className="text-sm text-gray-400 max-w-sm">좌측 인사 이동 대기 명단에서 부서 이동 처리를 시작할 대상을 클릭해 주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
