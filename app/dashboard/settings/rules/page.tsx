"use client";

import React, { useEffect, useState } from 'react';
import { Settings, Save, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function RulesPage() {
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [retiredAssetWarningDays, setRetiredAssetWarningDays] = useState(3);
  const [assetStockThreshold, setAssetStockThreshold] = useState(3);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setRetiredAssetWarningDays(data.retiredAssetWarningDays ?? 3);
        setAssetStockThreshold(data.assetStockThreshold ?? 3);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retiredAssetWarningDays,
          assetStockThreshold,
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: 'success', text: '경고 및 알림 규칙 설정이 성공적으로 저장되었습니다.' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        setStatusMsg({ type: 'error', text: '설정 저장에 실패했습니다. 올바른 값을 입력해 주세요.' });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setStatusMsg({ type: 'error', text: '설정 저장 중 서버 오류가 발생했습니다.' });
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">설정 규칙을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">경고 및 알림 규칙 설정</h1>
        <p className="text-gray-500 mt-2 text-base">퇴사자 자원 회수 경고 기준일 및 IT 자산 재고 알림 임계값을 관리하고 변경합니다.</p>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm transition-all duration-300 ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-red-500" />}
          <span className="font-medium">{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 space-y-8">
        
        {/* 설정 1: 퇴사자 미회수 자산 경고 기준일 */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-50 rounded-lg shrink-0 mt-0.5">
              <Clock className="text-[#EF4444]" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#020617]">퇴사자 자원 회수 경고 기준</h3>
              <p className="text-sm text-gray-500 mt-0.5">직원 퇴사 후 며칠 동안 지급 자산이 회수되지 않았을 때 대시보드에 경고(Critical)를 노출할지 설정합니다.</p>
            </div>
          </div>
          
          <div className="pl-12 flex items-center gap-4">
            <div className="w-48">
              <input
                type="number"
                min={1}
                max={30}
                required
                value={retiredAssetWarningDays}
                onChange={(e) => setRetiredAssetWarningDays(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] outline-none text-sm font-semibold"
              />
            </div>
            <span className="text-sm text-gray-600 font-medium">일 이내 회수 필요</span>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 설정 2: IT 자산 부족 알림 임계값 */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-50 rounded-lg shrink-0 mt-0.5">
              <AlertTriangle className="text-amber-500" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#020617]">IT 자산 재고 부족 경고 기준</h3>
              <p className="text-sm text-gray-500 mt-0.5">각 자산 카테고리(노트북, 모니터 등)의 미배정(보관 중) 재고 수량이 설정값 이하로 감소하면 대시보드에 경고 배너를 출력하고 경고 로그를 기록합니다.</p>
            </div>
          </div>

          <div className="pl-12 flex items-center gap-4">
            <div className="w-48">
              <input
                type="number"
                min={0}
                max={50}
                required
                value={assetStockThreshold}
                onChange={(e) => setAssetStockThreshold(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#00cfc1] outline-none text-sm font-semibold"
              />
            </div>
            <span className="text-sm text-gray-600 font-medium">대 이하 시 부족 경고 노출</span>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* 저장 버튼 */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saveLoading}
            className="px-6 py-3 bg-[#020617] hover:bg-gray-800 text-[#00cfc1] font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
          >
            {saveLoading ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            설정 규칙 저장
          </button>
        </div>

      </form>
    </div>
  );
}
