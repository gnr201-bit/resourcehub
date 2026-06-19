"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SaasService } from '@/types/database.types';
import { Settings, Shield, Monitor, Plus, Trash2, CheckCircle, Loader2 } from 'lucide-react';

interface TemplateConfig {
  default_asset_keyword: string;
  default_saas_names: string[];
}

export default function TemplatesSettingPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saasServices, setSaasServices] = useState<SaasService[]>([]);
  const [templates, setTemplates] = useState<Record<string, TemplateConfig>>({});
  const [selectedDept, setSelectedDept] = useState<string>('');
  
  // New department state
  const [newDeptName, setNewDeptName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Load SaaS services and templates
      const [saasResult, templateResponse] = await Promise.all([
        supabase
          .from('saas_services')
          .select('*')
          .order('name'),
        fetch('/api/templates')
      ]);

      setSaasServices(saasResult.data || []);
      
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        setTemplates(templateData);
        
        // Select first department by default
        const depts = Object.keys(templateData);
        if (depts.length > 0 && !selectedDept) {
          setSelectedDept(depts[0]);
        }
      }
    } catch (err) {
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveTemplates = async () => {
    setSaveLoading(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates)
      });

      if (response.ok) {
        alert('부서별 자원 템플릿 설정이 성공적으로 저장되었습니다.');
      } else {
        alert('템플릿 저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Save templates error:', err);
      alert('템플릿 저장 중 오류가 발생했습니다.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpdateKeyword = (keyword: string) => {
    if (!selectedDept) return;
    setTemplates(prev => ({
      ...prev,
      [selectedDept]: {
        ...prev[selectedDept],
        default_asset_keyword: keyword
      }
    }));
  };

  const handleToggleSaas = (saasName: string) => {
    if (!selectedDept) return;
    const currentList = templates[selectedDept]?.default_saas_names || [];
    const newList = currentList.includes(saasName)
      ? currentList.filter(name => name !== saasName)
      : [...currentList, saasName];

    setTemplates(prev => ({
      ...prev,
      [selectedDept]: {
        ...prev[selectedDept],
        default_saas_names: newList
      }
    }));
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName || newDeptName.trim() === '') return;
    
    const dept = newDeptName.trim();
    if (templates[dept]) {
      alert('이미 존재하는 부서명입니다.');
      return;
    }

    setTemplates(prev => ({
      ...prev,
      [dept]: {
        default_asset_keyword: '',
        default_saas_names: []
      }
    }));
    setSelectedDept(dept);
    setNewDeptName('');
  };

  const handleDeleteDepartment = (dept: string) => {
    const confirmDelete = window.confirm(`[${dept}] 템플릿을 정말 삭제하시겠습니까?`);
    if (!confirmDelete) return;

    const newTemplates = { ...templates };
    delete newTemplates[dept];
    setTemplates(newTemplates);

    const remainingDepts = Object.keys(newTemplates);
    if (remainingDepts.length > 0) {
      setSelectedDept(remainingDepts[0]);
    } else {
      setSelectedDept('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">부서별 자원 템플릿 정보를 가져오는 중...</p>
      </div>
    );
  }

  const currentTemplate = selectedDept ? templates[selectedDept] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">부서별 자원 템플릿 설정</h1>
        <p className="text-gray-500 mt-2 text-base">각 부서의 업무 유형에 적합한 IT 기기와 SaaS 라이선스 표준 배정 사양을 사전 구성하고 자동 매핑되도록 연동합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 좌측: 부서 템플릿 목록 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5 h-fit">
          <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2 border-b border-gray-100 pb-3">
            <Settings size={18} className="text-[#00cfc1]" />
            부서 목록
          </h3>

          {/* 신규 부서 추가 폼 */}
          <form onSubmit={handleAddDepartment} className="flex gap-2">
            <input
              type="text"
              placeholder="새 부서명 (예: 마케팅팀)"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-[#00cfc1] outline-none text-xs"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-[#020617] text-white hover:bg-gray-800 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              추가
            </button>
          </form>

          {/* 부서 목록 탭 */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {Object.keys(templates).length > 0 ? (
              Object.keys(templates).map((dept) => (
                <div
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                    selectedDept === dept
                      ? 'border-[#00cfc1] bg-[#00cfc1]/5 shadow-sm font-semibold'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm text-[#020617]">{dept}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDepartment(dept);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1 animate-in fade-in duration-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                설정된 부서가 없습니다. 새 부서를 추가해 보세요.
              </div>
            )}
          </div>
        </div>

        {/* 우측: 선택된 부서의 상세 설정 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedDept && currentTemplate ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="border-b border-gray-100 pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#020617]">
                    {selectedDept} 자원 템플릿 상세 설정
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">이 부서에 배정될 신규 입사자에게 자동으로 매핑될 자원 규칙을 선택합니다.</p>
                </div>
              </div>

              {/* 기본 IT 자산 키워드 매핑 */}
              <div className="space-y-2.5">
                <label className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Monitor size={18} className="text-[#3B82F6]" />
                  기본 지급 IT 자산 검색어 (키워드)
                </label>
                <input
                  type="text"
                  placeholder="예: MacBook, 그램, Dell 등 (자산 자동 선택 매핑에 사용됨)"
                  value={currentTemplate.default_asset_keyword || ''}
                  onChange={(e) => handleUpdateKeyword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none text-sm bg-white"
                />
                <p className="text-xs text-gray-400">입사자 자원 할당 화면 로딩 시, 재고 중 해당 키워드가 제품명/제조사에 들어간 노트북이 있을 경우 자동으로 기본 배정 세팅됩니다.</p>
              </div>

              {/* 기본 SaaS 매핑 체크박스 */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-[#020617] flex items-center gap-1.5">
                  <Shield size={18} className="text-[#84CC16]" />
                  기본 지급 SaaS 서비스 라이선스
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {saasServices.map((service) => {
                    const isChecked = (currentTemplate.default_saas_names || []).includes(service.name);
                    
                    return (
                      <div
                        key={service.id}
                        onClick={() => handleToggleSaas(service.name)}
                        className={`p-4 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all duration-200 ${
                          isChecked
                            ? 'border-[#00cfc1] bg-[#00cfc1]/5 animate-in fade-in zoom-in-95 duration-150'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="rounded border-gray-300 text-[#00cfc1] focus:ring-[#00cfc1] pointer-events-none"
                        />
                        <div>
                          <p className="text-sm font-bold text-[#020617]">{service.name}</p>
                          <p className="text-xs text-gray-400">월 {service.price_per_license?.toLocaleString() || 0}원</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400">이 부서에 속한 신규 입사자가 들어오면, 체크된 SaaS의 회사 이메일 계정이 기본 프로비저닝 체크 상태가 됩니다.</p>
              </div>

              {/* 하단 저장 버튼 */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveTemplates}
                  disabled={saveLoading}
                  className="px-6 py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
                >
                  {saveLoading ? (
                    '저장 중...'
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      템플릿 설정 저장
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white rounded-xl border border-gray-100 border-dashed p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-2">
                <Settings size={28} />
              </div>
              <h3 className="text-base font-bold text-[#020617]">선택된 부서가 없습니다</h3>
              <p className="text-sm text-gray-400 max-w-sm">좌측 부서 목록에서 템플릿 설정을 구성할 대상을 클릭하거나 새 부서를 추가해 주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
