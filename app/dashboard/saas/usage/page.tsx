"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SaasService } from '@/types/database.types';
import { Cloud, AlertTriangle, AlertCircle, CheckCircle2, Loader2, Plus, Sparkles, Filter, Code } from 'lucide-react';

export default function SaasUsagePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<SaasService[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | 'SaaS' | 'SW'>('All');

  // Add service modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [totalLicenses, setTotalLicenses] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('5');
  const [pricePerLicense, setPricePerLicense] = useState('');
  const [licenseType, setLicenseType] = useState<'SaaS' | 'SW'>('SaaS');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'perpetual'>('monthly');
  const [actionLoading, setActionLoading] = useState(false);

  // licenseType 변경 시 불가능한 billingCycle 리셋
  useEffect(() => {
    if (licenseType === 'SaaS' && billingCycle === 'perpetual') {
      setBillingCycle('monthly');
    }
  }, [licenseType, billingCycle]);

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

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !totalLicenses || !pricePerLicense) {
      alert('필수 입력 항목을 기입해 주세요.');
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('saas_services')
        .insert({
          name,
          total_licenses: parseInt(totalLicenses),
          used_licenses: 0,
          warning_threshold: parseInt(warningThreshold),
          price_per_license: parseFloat(pricePerLicense),
          license_type: licenseType,
          billing_cycle: billingCycle
        });

      if (error) {
        alert(`소프트웨어 등록 중 오류가 발생했습니다: ${error.message}`);
      } else {
        alert('신규 소프트웨어(SaaS)가 정상 등록되었습니다.');
        setIsModalOpen(false);
        // Reset form
        setName('');
        setTotalLicenses('');
        setWarningThreshold('5');
        setPricePerLicense('');
        setLicenseType('SaaS');
        setBillingCycle('monthly');
        await fetchServices();
      }
    } catch (err) {
      console.error('Add service error:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredServices = services.filter(service => {
    if (activeTab === 'All') return true;
    return service.license_type === activeTab;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">소프트웨어 라이선스 정보를 가져오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#020617] tracking-tight">라이선스 사용 현황</h1>
          <p className="text-gray-500 mt-2 text-base">각 협업 SaaS 솔루션 및 설치형 소프트웨어별 라이선스 총 수량 대비 임직원 활성화 비율을 모니터링합니다.</p>
        </div>
        <div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-all flex items-center gap-2 text-sm shadow-sm"
          >
            <Plus size={18} />
            신규 소프트웨어 등록
          </button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex border-b border-gray-100 space-x-2">
        <button
          onClick={() => setActiveTab('All')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${activeTab === 'All'
              ? 'border-[#00cfc1] text-[#00cfc1]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
          전체 ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('SaaS')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${activeTab === 'SaaS'
              ? 'border-[#00cfc1] text-[#00cfc1]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
          구독형 SaaS ({services.filter(s => s.license_type === 'SaaS').length})
        </button>
        <button
          onClick={() => setActiveTab('SW')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${activeTab === 'SW'
              ? 'border-[#00cfc1] text-[#00cfc1]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
        >
          설치형 소프트웨어 ({services.filter(s => s.license_type === 'SW').length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredServices.length > 0 ? (
          filteredServices.map((service) => {
            const used = service.used_licenses || 0;
            const total = service.total_licenses || 0;
            const remaining = Math.max(0, total - used);
            const usagePercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

            const isWarning = remaining <= service.warning_threshold;
            const isFull = remaining === 0;

            const billingCycleLabels = {
              monthly: { text: '월 구독', label: '단가 (월)', current: '현재 사용 금액 (월)', max: '최대 예산 범위 (월)' },
              yearly: { text: '연 구독', label: '단가 (연)', current: '현재 사용 금액 (연)', max: '최대 예산 범위 (연)' },
              perpetual: { text: '영구 구매', label: '단가 (일회성)', current: '현재 총 지출', max: '최대 자산 가치' }
            };
            const bc = billingCycleLabels[service.billing_cycle || 'monthly'] || billingCycleLabels.monthly;

            return (
              <div
                key={service.id}
                className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-6 relative overflow-hidden ${isFull
                    ? 'border-red-200 bg-red-50/5'
                    : isWarning
                      ? 'border-amber-200 bg-amber-50/5'
                      : 'border-gray-100'
                  }`}
              >
                {/* 상단 헤더 */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl ${isFull
                        ? 'bg-red-50 text-red-600'
                        : isWarning
                          ? 'bg-amber-50 text-amber-600'
                          : service.license_type === 'SW'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-teal-50 text-[#00cfc1]'
                      }`}>
                      {service.license_type === 'SW' ? <Code size={24} /> : <Cloud size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-[#020617]">{service.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${service.license_type === 'SW'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-teal-50 text-teal-600 border border-teal-100'
                          }`}>
                          {service.license_type === 'SW' ? '설치형 SW' : '구독형 SaaS'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-105 text-gray-600 border border-gray-200">
                          {bc.text}
                        </span>
                      </div>
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
                    <p className="text-xs text-gray-400 font-semibold mb-1">사용 중인 수량</p>
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
                    <p className="text-xs text-gray-400 font-semibold mb-1">{bc.label}</p>
                    <p className="text-sm font-bold text-gray-600">{(service.price_per_license || 0).toLocaleString()} <span className="text-xs text-gray-400 font-normal">원</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold mb-1">{bc.current}</p>
                    <p className="text-sm font-bold text-[#3B82F6]">{((service.price_per_license || 0) * used).toLocaleString()} <span className="text-xs text-gray-400 font-normal">원</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold mb-1">{bc.max}</p>
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
                      className={`h-2 rounded-full transition-all duration-500 ${isFull
                          ? 'bg-red-500'
                          : isWarning
                            ? 'bg-amber-500'
                            : 'bg-[#00cfc1]'
                        }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-16 text-center text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
            해당 조건의 소프트웨어가 존재하지 않습니다.
          </div>
        )}
      </div>

      {/* 신규 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-1.5">
                <Sparkles size={20} className="text-[#00cfc1]" />
                신규 소프트웨어(SaaS) 등록
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddService} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">라이선스 유형</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="license_type"
                      checked={licenseType === 'SaaS'}
                      onChange={() => setLicenseType('SaaS')}
                      className="text-[#00cfc1] focus:ring-[#00cfc1]"
                    />
                    구독형 SaaS
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="license_type"
                      checked={licenseType === 'SW'}
                      onChange={() => setLicenseType('SW')}
                      className="text-[#00cfc1] focus:ring-[#00cfc1]"
                    />
                    설치형 소프트웨어
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">소프트웨어/SaaS 이름</label>
                <input
                  type="text"
                  required
                  placeholder="예: Figma, Microsoft 365, AutoCAD"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">전체 라이선스 보유량</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="예: 50"
                    value={totalLicenses}
                    onChange={(e) => setTotalLicenses(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">재고 경고 임계값</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="예: 5"
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">비용 발생 방식</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="billing_cycle"
                      checked={billingCycle === 'monthly'}
                      onChange={() => setBillingCycle('monthly')}
                      className="text-[#00cfc1] focus:ring-[#00cfc1]"
                    />
                    월 구독
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="billing_cycle"
                      checked={billingCycle === 'yearly'}
                      onChange={() => setBillingCycle('yearly')}
                      className="text-[#00cfc1] focus:ring-[#00cfc1]"
                    />
                    연 구독
                  </label>
                  {licenseType === 'SW' && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="billing_cycle"
                        checked={billingCycle === 'perpetual'}
                        onChange={() => setBillingCycle('perpetual')}
                        className="text-[#00cfc1] focus:ring-[#00cfc1]"
                      />
                      영구 구매
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">
                  {billingCycle === 'monthly' ? '라이선스 단가 (월/원)' : billingCycle === 'yearly' ? '라이선스 단가 (연/원)' : '라이선스 단가 (일회성 구매/원)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder={billingCycle === 'monthly' ? '예: 15000' : billingCycle === 'yearly' ? '예: 180000' : '예: 500000'}
                  value={pricePerLicense}
                  onChange={(e) => setPricePerLicense(e.target.value)}
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
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors"
                >
                  {actionLoading ? '등록 중...' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
