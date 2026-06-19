"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SaasService } from '@/types/database.types';
import { Cloud, AlertTriangle, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export default function SaasUsagePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<SaasService[]>([]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('saas_services')
        .select('*')
        .order('name');
      setServices(data || []);
    } catch (err) {
      console.error('Fetch SaaS services error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">SaaS 라이선스 사용률 정보를 가져오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">라이선스 사용 현황</h1>
        <p className="text-gray-500 mt-2 text-base">각 협업 SaaS 솔루션별 구독 라이선스 총 수량 대비 임직원 활성화 비율을 모니터링합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => {
          const used = service.used_licenses || 0;
          const total = service.total_licenses || 0;
          const remaining = Math.max(0, total - used);
          const usagePercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
          
          const isWarning = remaining <= service.warning_threshold;
          const isFull = remaining === 0;

          return (
            <div 
              key={service.id} 
              className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-6 relative overflow-hidden ${
                isFull 
                  ? 'border-red-200 bg-red-50/5' 
                  : isWarning 
                    ? 'border-amber-200 bg-amber-50/5' 
                    : 'border-gray-100'
              }`}
            >
              {/* 상단 헤더 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl ${
                    isFull 
                      ? 'bg-red-50 text-red-600' 
                      : isWarning 
                        ? 'bg-amber-50 text-amber-600' 
                        : 'bg-teal-50 text-[#00cfc1]'
                  }`}>
                    <Cloud size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#020617]">{service.name}</h3>
                    <p className="text-xs text-gray-400">경고 임계값: 잔여 {service.warning_threshold}개 이하</p>
                  </div>
                </div>

                <div>
                  {isFull ? (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <AlertCircle size={12} /> 만료 / 부족
                    </span>
                  ) : isWarning ? (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <AlertTriangle size={12} /> 부족 경고
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> 여유 있음
                    </span>
                  )}
                </div>
              </div>

              {/* 사용 수량 정보 */}
              <div className="grid grid-cols-3 gap-4 border-t border-dashed border-gray-100 pt-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">전체 라이선스</p>
                  <p className="text-lg font-bold text-[#020617]">{total} <span className="text-xs text-gray-400 font-normal">개</span></p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">사용 중인 계정</p>
                  <p className="text-lg font-bold text-gray-700">{used} <span className="text-xs text-gray-400 font-normal">개</span></p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">남은 수량</p>
                  <p className={`text-lg font-bold ${isWarning ? 'text-[#EF4444]' : 'text-[#00cfc1]'}`}>{remaining} <span className="text-xs text-gray-400 font-normal">개</span></p>
                </div>
              </div>

              {/* 비용 정보 */}
              <div className="grid grid-cols-3 gap-4 border-y border-dashed border-gray-100 py-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">라이선스 단가 (월)</p>
                  <p className="text-sm font-bold text-gray-600">{(service.price_per_license || 0).toLocaleString()} <span className="text-xs text-gray-400 font-normal">원</span></p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">현재 사용 금액 (월)</p>
                  <p className="text-sm font-bold text-[#3B82F6]">{((service.price_per_license || 0) * used).toLocaleString()} <span className="text-xs text-gray-400 font-normal">원</span></p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">최대 예산 범위 (월)</p>
                  <p className="text-sm font-bold text-gray-600">{((service.price_per_license || 0) * total).toLocaleString()} <span className="text-xs text-gray-400 font-normal">원</span></p>
                </div>
              </div>

              {/* 사용률 바 차트 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">라이선스 사용률</span>
                  <span className="font-bold text-[#020617]">{usagePercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isFull 
                        ? 'bg-red-500' 
                        : isWarning 
                          ? 'bg-amber-500' 
                          : 'bg-[#00cfc1]'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
