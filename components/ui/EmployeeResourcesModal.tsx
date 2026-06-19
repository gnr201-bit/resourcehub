"use client";

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Asset, SaasAccount } from '@/types/database.types';
import { Monitor, Cloud, User, Building, Loader2, X, AlertCircle } from 'lucide-react';

interface EmployeeResourcesModalProps {
  employeeId: string;
  employeeName: string;
  employeeDept?: string;
  employeeRole?: string;
}

export default function EmployeeResourcesModal({
  employeeId,
  employeeName,
  employeeDept,
  employeeRole
}: EmployeeResourcesModalProps) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [saas, setSaas] = useState<any[]>([]);

  const handleOpen = async () => {
    setIsOpen(true);
    setLoading(true);
    try {
      const [assetResult, saasResult] = await Promise.all([
        supabase
          .from('assets')
          .select('*')
          .eq('assigned_to', employeeId),
        supabase
          .from('saas_accounts')
          .select('*, saas_services(name)')
          .eq('employee_id', employeeId)
          .eq('status', 'active')
      ]);

      setAssets(assetResult.data || []);
      setSaas(saasResult.data || []);
    } catch (err) {
      console.error('Fetch employee resources error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 트리거 버튼 (직원 이름 클릭 시 작동) */}
      <button
        onClick={handleOpen}
        className="text-[#00cfc1] hover:text-[#00a89a] hover:underline font-bold transition-all text-left focus:outline-none"
      >
        {employeeName}
      </button>

      {/* 모달 팝업 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 relative">
            
            {/* 닫기 버튼 */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>

            {/* 헤더 */}
            <div className="flex items-center space-x-4 border-b border-gray-100 pb-4">
              <div className="w-12 h-12 bg-[#020617] text-[#00cfc1] rounded-xl flex items-center justify-center font-bold text-lg">
                <User size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#020617]">{employeeName} 사원 할당 자원</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {employeeDept || '부서 미지정'} · {employeeRole || '직급 미지정'}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="animate-spin text-[#00cfc1]" size={36} />
                <p className="text-sm text-gray-400">자원 목록을 불러오는 중...</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-1">
                
                {/* IT 자산 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[#020617] flex items-center gap-1.5 border-b border-dashed border-gray-100 pb-1.5">
                    <Monitor size={16} className="text-[#3B82F6]" />
                    할당된 IT 자산 ({assets.length}대)
                  </h4>
                  <div className="space-y-2">
                    {assets.length > 0 ? (
                      assets.map((asset) => (
                        <div key={asset.id} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-[#020617]">{asset.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">S/N: {asset.serial_number} {asset.spec ? `· 사양: ${asset.spec}` : ''}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md font-semibold shrink-0">
                            사용 중
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 py-3 text-center">할당된 IT 자산이 없습니다.</p>
                    )}
                  </div>
                </div>

                {/* SaaS 라이선스 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-[#020617] flex items-center gap-1.5 border-b border-dashed border-gray-100 pb-1.5">
                    <Cloud size={16} className="text-[#84CC16]" />
                    사용 중인 SaaS 계정 ({saas.length}개)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {saas.length > 0 ? (
                      saas.map((account) => (
                        <div key={account.id} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-[#020617]">{account.saas_services?.name || 'SaaS'}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{account.email}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-bold shrink-0">
                            활성
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="col-span-2 text-xs text-gray-400 py-3 text-center">활성화된 SaaS 계정이 없습니다.</p>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* 하단 버튼 */}
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 bg-[#020617] text-white hover:bg-gray-800 text-xs font-bold rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
