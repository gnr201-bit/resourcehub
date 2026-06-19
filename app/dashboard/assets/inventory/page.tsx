"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Asset, Employee } from '@/types/database.types';
import { Plus, Monitor, Search, Filter, Loader2, Edit3, Trash2, UserPlus, Check } from 'lucide-react';

export default function AssetInventoryPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Add asset form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('노트북');
  const [spec, setSpec] = useState('');
  const [price, setPrice] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [modelName, setModelName] = useState('');
  const [location, setLocation] = useState('IT자산고');

  // Assignment modal state
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedAssetStatus, setSelectedAssetStatus] = useState('unassigned');
  const [assetLocation, setAssetLocation] = useState('');

  // Bulk upload state
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkAssets, setBulkAssets] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 2개의 쿼리를 병렬로 실행하여 패치 속도를 개선합니다.
      const [assetResult, empResult] = await Promise.all([
        supabase
          .from('assets')
          .select('*, employees(id, name, department)')
          .order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('*')
          .eq('status', 'active')
          .order('name')
      ]);

      const assetData = assetResult.data;
      const empData = empResult.data;

      setAssets(assetData || []);
      setEmployees(empData || []);
    } catch (err) {
      console.error('Fetch inventory error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // CSV 템플릿 다운로드 기능
  const downloadCSVSample = () => {
    const headers = ['일련번호', '자산명', '카테고리', '상세사양', '구매가격', '제조사', '모델명', '보관위치'];
    const sampleRow = ['SN-SAMPLE-01', 'MacBook Pro 14', '노트북', 'M3 / 16G / 512G', '2390000', 'Apple', 'A3112', 'IT자산고'];
    // UTF-8 BOM to prevent Korean character corruption in Excel
    const csvContent = '\uFEFF' + [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'IT_Asset_Bulk_Template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV 파일 업로드 및 파싱 핸들러
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length <= 1) {
        alert('CSV 파일에 데이터가 존재하지 않습니다.');
        return;
      }

      const newAssets: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Simple comma split (could be enhanced, but fine for simple templates)
        const currentLine = lines[i].split(',').map(val => val.trim());
        if (currentLine.length < 2) continue;

        const serial_number = currentLine[0];
        const name = currentLine[1];
        const category = currentLine[2] || '기타';
        const spec = currentLine[3] || null;
        const price = currentLine[4] ? parseFloat(currentLine[4]) : null;
        const manufacturer = currentLine[5] || null;
        const model_name = currentLine[6] || null;
        const location = currentLine[7] || 'IT자산고';

        if (!serial_number || !name) {
          alert(`${i}번째 줄: 일련번호와 자산명은 필수 항목입니다.`);
          return;
        }

        newAssets.push({
          serial_number,
          name,
          category,
          spec,
          price,
          manufacturer,
          model_name,
          status: 'unassigned',
          location,
          purchased_at: new Date().toISOString().split('T')[0]
        });
      }

      if (newAssets.length === 0) {
        alert('업로드할 유효한 자산 데이터가 없습니다.');
        return;
      }

      setBulkAssets(newAssets);
    };
    reader.readAsText(file, 'utf-8');
  };

  // CSV 벌크 인서트 확정 승인 처리
  const handleConfirmBulkUpload = async () => {
    if (bulkAssets.length === 0) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('assets')
        .insert(bulkAssets);

      if (error) {
        alert(`대량 등록 오류: ${error.message}`);
        await supabase.from('sync_logs').insert({
          log_type: 'asset_registration',
          status: 'error',
          message: `IT 자산 ${bulkAssets.length}대 대량 등록 실패`,
          details: error.message
        });
      } else {
        await supabase.from('sync_logs').insert({
          log_type: 'asset_registration',
          status: 'success',
          message: `IT 자산 ${bulkAssets.length}대 대량 등록 성공`,
          details: `등록된 S/N: ${bulkAssets.map(a => a.serial_number).join(', ')}`
        });
        alert(`성공적으로 ${bulkAssets.length}대의 자산이 일괄 등록되었습니다.`);
        setIsBulkUploadModalOpen(false);
        setBulkAssets([]);
        await fetchData();
      }
    } catch (err) {
      console.error('Bulk upload exception:', err);
      alert('대량 등록 처리 중 오류가 발생했습니다.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber || !name) {
      alert('일련번호와 자산명은 필수 항목입니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('assets')
        .insert({
          serial_number: serialNumber,
          name,
          category,
          spec: spec || null,
          price: price ? parseFloat(price) : null,
          manufacturer: manufacturer || null,
          model_name: modelName || null,
          status: 'unassigned',
          location,
          purchased_at: new Date().toISOString().split('T')[0]
        });

      if (error) {
        alert(`자산 추가 오류: ${error.message}`);
        try {
          await supabase
            .from('sync_logs')
            .insert({
              log_type: 'asset_registration',
              status: 'error',
              message: `신규 자산 [${name}] 등록 실패 (S/N: ${serialNumber})`,
              details: error.message
            });
        } catch (logErr) {
          console.error('Failed to log asset registration error:', logErr);
        }
      } else {
        try {
          await supabase
            .from('sync_logs')
            .insert({
              log_type: 'asset_registration',
              status: 'success',
              message: `신규 자산 [${name}] 등록 완료 (S/N: ${serialNumber})`,
              details: `카테고리: ${category}, 보관 위치: ${location}, 제조사: ${manufacturer || '-'}`
            });
        } catch (logErr) {
          console.error('Failed to log asset registration success:', logErr);
        }
        alert('신규 자산이 정상 등록되었습니다.');
        setIsModalOpen(false);
        // 폼 리셋
        setSerialNumber('');
        setName('');
        setSpec('');
        setPrice('');
        setManufacturer('');
        setModelName('');
        await fetchData();
      }
    } catch (err) {
      console.error('Add asset exception:', err);
    }
  };

  const handleOpenAssign = (asset: Asset) => {
    setAssigningAsset(asset);
    setSelectedEmployeeId(asset.assigned_to || '');
    setSelectedAssetStatus(asset.status);
    setAssetLocation(asset.location || '');
  };

  const handleSaveAssignment = async () => {
    if (!assigningAsset) return;

    try {
      const empId = selectedEmployeeId || null;
      // 배정 대상이 있으면 'normal', 없으면 선택한 상태 사용 (수리중/폐기 등)
      const finalStatus = empId ? 'normal' : selectedAssetStatus;

      // 1. 자산 배정 및 상태 정보 업데이트
      await supabase
        .from('assets')
        .update({
          assigned_to: empId,
          assigned_at: empId ? new Date().toISOString() : null,
          status: finalStatus,
          location: assetLocation || null
        })
        .eq('id', assigningAsset.id);

      // 2. 상태 변경 이력 로그 기록
      const statusChanged = assigningAsset.status !== finalStatus;
      const assignChanged = assigningAsset.assigned_to !== empId;
      const empName = empId ? employees.find(e => e.id === empId)?.name || empId : null;

      const logMessages: string[] = [];
      if (assignChanged) {
        logMessages.push(empId 
          ? `자산 [${assigningAsset.name}]이(가) ${empName}에게 배정되었습니다.`
          : `자산 [${assigningAsset.name}]이(가) 회수되었습니다.`);
      }
      if (statusChanged) {
        const statusLabels: Record<string, string> = { normal: '정상(사용중)', unassigned: '미배정(재고)', repairing: '수리 중', disposed: '폐기' };
        logMessages.push(`자산 [${assigningAsset.name}] 상태 변경: ${statusLabels[assigningAsset.status] || assigningAsset.status} → ${statusLabels[finalStatus] || finalStatus}`);
      }

      if (logMessages.length > 0) {
        await supabase
          .from('sync_logs')
          .insert(logMessages.map(msg => ({
            log_type: statusChanged ? 'asset_status_change' : 'asset_assignment',
            status: 'success' as const,
            message: msg
          })));
      }

      alert('자산 정보가 성공적으로 반영되었습니다.');
      setAssigningAsset(null);
      await fetchData();
    } catch (err) {
      console.error('Save assignment error:', err);
    }
  };

  // 필터링 적용
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.employees as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === 'All' || asset.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || asset.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-[#00cfc1]" size={40} />
        <p className="text-gray-500 text-sm">IT 자산 재고 데이터를 가져오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#020617] tracking-tight">IT 자산 재고 및 목록</h1>
          <p className="text-gray-500 mt-2 text-base">조직 내 하드웨어(노트북, 모니터 등)의 실시간 수량, 배정주체, 재고 현황을 통합 관리합니다.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsBulkUploadModalOpen(true)}
            className="px-5 py-3 border border-gray-200 hover:bg-gray-50 text-[#020617] font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm bg-white"
          >
            <Plus size={18} />
            CSV 대량 등록
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm"
          >
            <Plus size={18} />
            신규 자산 등록
          </button>
        </div>
      </div>

      {/* 검색 및 필터 패널 */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="자산명, S/N, 배정 대상자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#00cfc1] focus:ring-2 focus:ring-[#00cfc1]/20 transition-all outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* 카테고리 필터 */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
            >
              <option value="All">모든 카테고리</option>
              <option value="노트북">노트북</option>
              <option value="모니터">모니터</option>
              <option value="태블릿">태블릿</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 상태 필터 */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
          >
            <option value="All">모든 상태</option>
            <option value="unassigned">미배정 (재고)</option>
            <option value="normal">정상 (사용중)</option>
            <option value="repairing">수리 중</option>
            <option value="disposed">폐기</option>
          </select>
        </div>
      </div>

      {/* 자산 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">자산 식별 정보</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기기 정보</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">배정 현황</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">보관 위치</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const empName = (asset.employees as any)?.name;
                  const empDept = (asset.employees as any)?.department;
                  
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-bold text-[#020617]">{asset.name}</div>
                        <div className="text-xs text-gray-400">S/N: {asset.serial_number}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-xs text-gray-600">{asset.manufacturer} | {asset.model_name}</div>
                        <div className="text-xs text-gray-400 max-w-[200px] truncate">{asset.spec || '-'}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-[#020617]">
                        {empName ? (
                          <div>
                            <span className="font-semibold">{empName}</span>
                            <span className="text-xs text-gray-400 ml-1">({empDept})</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {asset.location || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          asset.status === 'normal'
                            ? 'bg-emerald-50 text-emerald-600'
                            : asset.status === 'unassigned'
                              ? 'bg-blue-50 text-blue-600'
                              : asset.status === 'repairing'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-gray-100 text-gray-500'
                        }`}>
                          {asset.status === 'normal' && '사용 중'}
                          {asset.status === 'unassigned' && '미배정 (재고)'}
                          {asset.status === 'repairing' && '수리 중'}
                          {asset.status === 'disposed' && '폐기'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold">
                        <button
                          onClick={() => handleOpenAssign(asset)}
                          className="text-[#00cfc1] hover:text-[#00a89a] text-xs font-bold mr-3"
                        >
                          배정/회수
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                    검색 결과와 일치하는 자산이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 자산 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617]">신규 IT 자산 등록</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">일련번호 (S/N)</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="SN-XXX-XXXX"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">자산명</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='예: MacBook Pro 16"'
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                  >
                    <option value="노트북">노트북</option>
                    <option value="모니터">모니터</option>
                    <option value="태블릿">태블릿</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">보관/배정 위치</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: IT자산고, 서울본사 10층"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">제조사</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="예: Apple"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">모델명</label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="예: A2989"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600">구매가격 (원)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="예: 3000000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">규격 및 상세사양</label>
                <textarea
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  placeholder="예: M3 Pro, 18GB, 512GB"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none resize-none"
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
                  className="px-4 py-2 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 배정/회수 모달 */}
      {assigningAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617]">자산 배정 및 회수 설정</h3>
              <button onClick={() => setAssigningAsset(null)} className="text-gray-400 hover:text-gray-600 text-sm font-semibold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400">대상 자산</p>
                <p className="text-sm font-bold text-[#020617]">{assigningAsset.name}</p>
                <p className="text-xs text-gray-500">S/N: {assigningAsset.serial_number}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">배정할 임직원 선택</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1]"
                >
                  <option value="">-- 배정 안 함 (IT창고 회수) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department} - {emp.role_title})
                    </option>
                  ))}
                </select>
              </div>

              {/* 자산 상태 변경 (PRD 3.1.4) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">자산 상태 변경</label>
                <select
                  value={selectedAssetStatus}
                  onChange={(e) => setSelectedAssetStatus(e.target.value)}
                  disabled={!!selectedEmployeeId}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-[#00cfc1] disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="unassigned">미배정 (재고)</option>
                  <option value="normal">정상 (사용중)</option>
                  <option value="repairing">수리 중</option>
                  <option value="disposed">폐기</option>
                </select>
                {selectedEmployeeId && (
                  <p className="text-[10px] text-gray-400">임직원이 배정된 경우 상태는 자동으로 &apos;정상&apos;으로 설정됩니다.</p>
                )}
              </div>

              {/* 보관/배정 위치 변경 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600">보관/배정 위치</label>
                <input
                  type="text"
                  value={assetLocation}
                  onChange={(e) => setAssetLocation(e.target.value)}
                  placeholder="예: IT자산고, 서울본사 10층"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#00cfc1] outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAssigningAsset(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="px-4 py-2 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <Check size={14} />
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV 대량 업로드 모달 */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
                <Monitor className="text-[#00cfc1]" size={20} />
                CSV 대량 IT 자산 등록
              </h3>
              <button 
                onClick={() => {
                  setIsBulkUploadModalOpen(false);
                  setBulkAssets([]);
                }} 
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-700">1. 대량 업로드 템플릿 다운로드</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">양식에 맞춰 자산 데이터를 기록한 뒤 업로드해야 에러가 발생하지 않습니다.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadCSVSample}
                  className="px-3.5 py-2 bg-[#020617] hover:bg-gray-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                >
                  템플릿 다운로드
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-700">2. CSV 파일 업로드</p>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-[#00cfc1] transition-all relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-600">CSV 파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="text-xs text-gray-400">지원 형식: UTF-8 인코딩의 CSV 파일 (*.csv)</p>
                  </div>
                </div>
              </div>

              {/* 미리보기 영역 */}
              {bulkAssets.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-gray-700">3. 업로드 데이터 미리보기 (총 {bulkAssets.length}건)</p>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      정합성 검증 완료
                    </span>
                  </div>
                  
                  <div className="overflow-hidden rounded-xl border border-gray-150 max-h-48 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-150 text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-xs font-bold text-gray-500">S/N</th>
                          <th className="px-4 py-2 text-xs font-bold text-gray-500">자산명</th>
                          <th className="px-4 py-2 text-xs font-bold text-gray-500">카테고리</th>
                          <th className="px-4 py-2 text-xs font-bold text-gray-500">사양</th>
                          <th className="px-4 py-2 text-xs font-bold text-gray-500">위치</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs bg-white">
                        {bulkAssets.slice(0, 5).map((asset, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2 font-mono text-gray-600">{asset.serial_number}</td>
                            <td className="px-4 py-2 font-semibold text-gray-800">{asset.name}</td>
                            <td className="px-4 py-2 text-gray-500">{asset.category}</td>
                            <td className="px-4 py-2 text-gray-400 truncate max-w-[120px]">{asset.spec || '-'}</td>
                            <td className="px-4 py-2 text-gray-500">{asset.location}</td>
                          </tr>
                        ))}
                        {bulkAssets.length > 5 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-2 text-center text-gray-400 bg-gray-50/30">
                              외 {bulkAssets.length - 5}건의 데이터가 더 존재합니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setBulkAssets([]);
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={bulkAssets.length === 0 || bulkLoading}
                  onClick={handleConfirmBulkUpload}
                  className="px-4 py-2 bg-[#00cfc1] hover:bg-[#00a89a] text-[#020617] text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {bulkLoading ? '일괄 등록 중...' : `일괄 등록 완료 (${bulkAssets.length}건)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
