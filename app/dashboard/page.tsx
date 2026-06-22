import React from 'react';
import { AlertTriangle, Monitor, Cloud, UserCheck, Calendar, ArrowRight } from 'lucide-react';
import { createClient, checkAdminOrRedirect } from '@/lib/supabase/server';
import Link from 'next/link';
import EmployeeResourcesModal from '@/components/ui/EmployeeResourcesModal';
import fs from 'fs';
import path from 'path';

export const revalidate = 0; // 대시보드는 매번 최신 데이터를 조회하도록 설정
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await checkAdminOrRedirect();
  const supabase = await createClient();

  // lib/settings.json에서 동적 설정값 로드 (P2 기능)
  let retiredAssetWarningDays = 3;
  let assetStockThreshold = 3;
  try {
    const settingsPath = path.join(process.cwd(), 'lib', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      retiredAssetWarningDays = settings.retiredAssetWarningDays ?? 3;
      assetStockThreshold = settings.assetStockThreshold ?? 3;
    }
  } catch (err) {
    console.error('Failed to read settings from json in page:', err);
  }

  // 7개의 쿼리를 병렬(동시)로 실행하여 속도를 대폭 개선합니다.
  const [
    employeeCountResult,
    assetCountResult,
    saasDataResult,
    pendingOffboardingsResult,
    recentAssignmentsResult,
    assetCategoryResult,
    pendingRequestsResult
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, department, role_title')
      .eq('status', 'active'),
    supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .not('assigned_to', 'is', null),
    supabase
      .from('saas_services')
      .select('id, name, total_licenses, used_licenses, warning_threshold, price_per_license, license_type, billing_cycle'),
    supabase
      .from('hr_events')
      .select('id, status, employee_id, employees!inner(id, name, department, retired_at, role_title)')
      .eq('event_type', 'offboarding')
      .neq('status', 'completed'),
    supabase
      .from('assets')
      .select('id, name, serial_number, assigned_at, employees(name, department)')
      .not('assigned_to', 'is', null)
      .order('assigned_at', { ascending: false })
      .limit(5),
    supabase
      .from('assets')
      .select('category, status, assigned_to'),
    supabase
      .from('resource_requests')
      .select('id, resource_name, resource_category, request_type, created_at, employees(name, department)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)
  ]);

  const employees = employeeCountResult.data || [];
  const employeeCount = employees.length;
  const assetCount = assetCountResult.count;
  const saasData = saasDataResult.data;
  const pendingOffboardings = pendingOffboardingsResult.data || [];
  const recentAssignments = recentAssignmentsResult.data;
  const assetCategoryData = assetCategoryResult.data;
  const pendingRequests = pendingRequestsResult.data;

  // 퇴사 회수 대기 직원들의 미회수 자원(IT 자산 & SaaS 계정) 병렬 조회
  const pendingEmpIds = pendingOffboardings.map((o: any) => o.employee_id);
  const [pendingAssetsResult, pendingSaasResult] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, serial_number, assigned_to, category')
      .in('assigned_to', pendingEmpIds),
    supabase
      .from('saas_accounts')
      .select('id, employee_id, email, saas_services!inner(name)')
      .in('employee_id', pendingEmpIds)
      .eq('status', 'active')
  ]);

  const pendingAssets = pendingAssetsResult.data || [];
  const pendingSaas = pendingSaasResult.data || [];

  // 임직원 부서/직급 분포 계산
  const deptDistribution: Record<string, number> = {};
  const roleDistribution: Record<string, number> = {};
  employees.forEach((emp: any) => {
    const dept = emp.department || '미지정';
    const role = emp.role_title || '미지정';
    deptDistribution[dept] = (deptDistribution[dept] || 0) + 1;
    roleDistribution[role] = (roleDistribution[role] || 0) + 1;
  });

  // Supabase 쿼리 오류 수집 및 로깅
  const errors = [
    { name: '재직 임직원수 조회', error: employeeCountResult.error },
    { name: '배정 자산수 조회', error: assetCountResult.error },
    { name: 'SaaS 데이터 조회', error: saasDataResult.error },
    { name: '퇴사자 미회수 자산 조회', error: pendingOffboardingsResult.error },
    { name: '최근 자산 배정 현황 조회', error: recentAssignmentsResult.error },
    { name: 'IT 자산 카테고리 조회', error: assetCategoryResult.error },
    { name: '대기 중인 요청 조회', error: pendingRequestsResult.error }
  ].filter(x => x.error);

  if (errors.length > 0) {
    console.error('=== Supabase Dashboard Query Errors ===');
    errors.forEach(e => {
      console.error(`[${e.name}] error:`, e.error);
    });
  }

  let totalLicenses = 0;
  let usedLicenses = 0;
  let totalMonthlyCost = 0;
  let maxMonthlyCost = 0;
  if (saasData) {
    saasData.forEach(s => {
      totalLicenses += s.total_licenses || 0;
      usedLicenses += s.used_licenses || 0;

      const price = s.price_per_license || 0;
      const used = s.used_licenses || 0;
      const total = s.total_licenses || 0;
      const cycle = s.billing_cycle || 'monthly';

      if (cycle === 'monthly') {
        totalMonthlyCost += used * price;
        maxMonthlyCost += total * price;
      } else if (cycle === 'yearly') {
        totalMonthlyCost += (used * price) / 12;
        maxMonthlyCost += (total * price) / 12;
      }
      // perpetual(영구)은 일회성이므로 월 구독 예산 집계에서는 제외
    });
  }
  const saasUsageRate = totalLicenses > 0 ? Math.round((usedLicenses / totalLicenses) * 100) : 0;

  const criticalList = pendingOffboardings.map((o: any) => {
    const emp = o.employees;
    const empAssets = pendingAssets.filter((a: any) => a.assigned_to === emp.id);
    const empSaas = pendingSaas.filter((s: any) => s.employee_id === emp.id);
    return {
      ...emp,
      eventId: o.id,
      eventDate: o.retired_at || emp.retired_at,
      assets: empAssets,
      saas: empSaas
    };
  });

  const criticalCount = criticalList.length;
  const pendingRequestCount = pendingRequests?.length || 0;

  // IT 자산 카테고리별 통계 및 미배정(unassigned) 재고 계산
  const categoryStats: Record<string, { total: number; assigned: number; unassigned: number }> = {};
  if (assetCategoryData) {
    assetCategoryData.forEach((a: any) => {
      if (!categoryStats[a.category]) {
        categoryStats[a.category] = { total: 0, assigned: 0, unassigned: 0 };
      }
      categoryStats[a.category].total++;
      if (a.assigned_to) {
        categoryStats[a.category].assigned++;
      } else {
        categoryStats[a.category].unassigned++;
      }
    });
  }

  const totalAssetsCount = assetCategoryData?.length || 0;
  const assignedAssetsCount = assetCategoryData?.filter((a: any) => a.assigned_to).length || 0;
  const assetUsageRate = totalAssetsCount > 0 ? Math.round((assignedAssetsCount / totalAssetsCount) * 100) : 0;

  // 재고 부족 임계값 설정 (설정파일 기준)
  const STOCK_WARNING_THRESHOLD = assetStockThreshold;
  const stockWarnings = Object.entries(categoryStats)
    .map(([category, stat]) => ({
      category,
      unassigned: stat.unassigned
    }))
    .filter(warn => warn.unassigned <= STOCK_WARNING_THRESHOLD);

  // 재고 부족 경고 로그 비동기 적재 (24시간 이내 동일 카테고리 경고가 없을 때만)
  if (stockWarnings.length > 0) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    Promise.all(
      stockWarnings.map(async (warn) => {
        try {
          const { data: existingLogs } = await supabase
            .from('sync_logs')
            .select('id')
            .eq('log_type', 'IT Asset Stock')
            .eq('status', 'warning')
            .like('message', `${warn.category}%`)
            .gte('created_at', oneDayAgo);

          if (!existingLogs || existingLogs.length === 0) {
            await supabase.from('sync_logs').insert({
              log_type: 'IT Asset Stock',
              status: 'warning',
              message: `${warn.category} 재고 부족 경고 (현재 남은 수량: ${warn.unassigned}대)`,
              details: `카테고리: ${warn.category}, 미배정 자산 수량: ${warn.unassigned}대 (임계값: ${STOCK_WARNING_THRESHOLD}대)`
            });
          }
        } catch (err) {
          console.error('Failed to log stock warning:', err);
        }
      })
    ).catch(err => console.error('Promise.all error in stock warning:', err));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#020617] tracking-tight">통합 대시보드</h1>
        <p className="text-gray-500 mt-2 text-base">기업 전체의 실시간 자원 할당 및 라이선스 이용 상태를 한눈에 모니터링합니다.</p>
      </div>

      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <AlertTriangle size={18} />
            <span>Supabase 연동 오류 발생 ({errors.length}건)</span>
          </div>
          <p className="text-xs text-red-600">데이터베이스 쿼리 중 오류가 발생했습니다. 아래 오류 메시지를 참고하여 Supabase 테이블과 구조를 확인해 주세요.</p>
          <pre className="text-xs text-red-600 overflow-auto max-h-40 p-3 bg-red-100/50 rounded-lg border border-red-200">
            {JSON.stringify(errors.map(e => ({ query: e.name, details: e.error })), null, 2)}
          </pre>
        </div>
      )}

      {/* 메트릭 카드 영역 (4열 그리드) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="relative group/tooltip">
          <Link href="/dashboard/settings/hr-sync" className="block">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:border-[#00cfc1]/50 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 hover:text-[#00cfc1] transition-colors">재직 중 임직원</h3>
                <div className="p-2 bg-[#00cfc1]/10 rounded-lg hover:bg-[#00cfc1]/20 transition-colors">
                  <UserCheck className="text-[#00cfc1]" size={20} />
                </div>
              </div>
              <div className="flex items-baseline">
                <p className="text-3xl font-bold text-[#020617]">{employeeCount || 0}</p>
                <span className="text-sm font-normal text-gray-400 ml-1">명</span>
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">인사 연동 데이터 기준 <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
            </div>
          </Link>

          {/* 부서/직급 분포 팝오버 툴팁 */}
          <div className="absolute left-0 top-full mt-2 hidden group-hover/tooltip:block bg-[#0f172a] text-white p-4 rounded-xl text-xs z-50 shadow-xl min-w-[240px] border border-gray-800 pointer-events-none">
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-[#00cfc1] border-b border-gray-850 pb-1 mb-1.5">부서별 분포</h4>
                <div className="space-y-1">
                  {Object.entries(deptDistribution).map(([dept, count]) => (
                    <div key={dept} className="flex justify-between">
                      <span className="text-gray-300">{dept}</span>
                      <span className="font-semibold">{count}명</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-[#3B82F6] border-b border-gray-855 pb-1 mb-1.5">직급별 분포</h4>
                <div className="space-y-1">
                  {Object.entries(roleDistribution).map(([role, count]) => (
                    <div key={role} className="flex justify-between">
                      <span className="text-gray-300">{role}</span>
                      <span className="font-semibold">{count}명</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Link href="/dashboard/assets/inventory" className="block group">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:border-[#3B82F6]/50 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 group-hover:text-[#3B82F6] transition-colors">배정된 IT 자산</h3>
              <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                <Monitor className="text-[#3B82F6]" size={20} />
              </div>
            </div>
            <div className="flex items-baseline">
              <p className="text-3xl font-bold text-[#020617]">{assignedAssetsCount || 0}</p>
              <span className="text-sm font-normal text-gray-400 ml-1">/ {totalAssetsCount || 0} 대</span>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-3 font-semibold">{assetUsageRate}%</span>
            </div>

            {/* 자산 사용률 프로그레스 바 */}
            <div className="mt-4 space-y-1">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-[#3B82F6] h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${assetUsageRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/saas/usage" className="block group">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:border-[#84CC16]/50 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 group-hover:text-[#84CC16] transition-colors">SaaS 월 구독 비용</h3>
              <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <Cloud className="text-[#84CC16]" size={20} />
              </div>
            </div>
            <div className="flex items-baseline">
              <p className="text-3xl font-bold text-[#020617]">{totalMonthlyCost.toLocaleString()}</p>
              <span className="text-sm font-normal text-gray-400 ml-1">원</span>
            </div>

            {/* 실사용 비용 vs 최대 예상 비용 표시 */}
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span>최대 예상 비용 (한도)</span>
                <span className="font-semibold text-gray-600">{maxMonthlyCost.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>라이선스 사용률</span>
                <span className="font-semibold text-gray-600">{saasUsageRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-[#84CC16] h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${saasUsageRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/hr-events/offboarding" className="block group">
          <div className={`p-6 rounded-xl border relative overflow-hidden transition-all duration-200 hover:shadow-md h-full cursor-pointer ${criticalCount > 0 ? 'border-red-200 bg-red-50/10 hover:border-[#EF4444]/50' : 'border-gray-100 hover:border-gray-300'
            }`}>
            {criticalCount > 0 && <div className="absolute top-0 left-0 w-1.5 h-full bg-[#EF4444]"></div>}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 group-hover:text-[#EF4444] transition-colors">퇴사자 미회수 자산</h3>
              <div className={`p-2 rounded-lg ${criticalCount > 0 ? 'bg-red-50 group-hover:bg-red-100' : 'bg-gray-50 group-hover:bg-gray-100'} transition-colors`}>
                <AlertTriangle className={criticalCount > 0 ? 'text-[#EF4444]' : 'text-gray-400'} size={20} />
              </div>
            </div>
            <div className="flex items-baseline">
              <p className={`text-3xl font-bold ${criticalCount > 0 ? 'text-[#EF4444]' : 'text-[#020617]'}`}>
                {criticalCount}
              </p>
              <span className="text-sm font-normal text-gray-400 ml-1">건</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">즉시 회수 처리가 필요합니다 <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
          </div>
        </Link>
      </div>

      {/* 상세 영역 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* 왼쪽 2열: 대기 중인 자원 요청 & 최근 자산 배정 현황 */}
        <div className="lg:col-span-2 space-y-8">

          {/* 대기 중인 자원 요청 (상향 리배치) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
                대기 중인 자원 요청
                {pendingRequestCount > 0 && (
                  <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                    {pendingRequestCount}건
                  </span>
                )}
              </h3>
              <Link
                href="/dashboard/portal/admin-requests"
                className="text-sm font-semibold text-[#00cfc1] hover:text-[#00a89a] flex items-center gap-1 transition-colors"
              >
                요청 관리 →
              </Link>
            </div>

            <div className="space-y-2">
              {pendingRequests && pendingRequests.length > 0 ? (
                pendingRequests.map((req: any) => (
                  <div key={req.id} className="p-3.5 border border-amber-100 bg-amber-50/5 rounded-xl flex items-center justify-between hover:bg-amber-50/20 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${req.request_type === 'new_resource' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                          {req.request_type === 'new_resource' ? '신규' : '반납'}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">[{req.resource_category}]</span>
                        <p className="text-sm font-bold text-[#020617]">{req.resource_name}</p>
                      </div>
                      <p className="text-xs text-gray-450 mt-1">
                        {(req.employees as any)?.name || '-'} ({(req.employees as any)?.department || '-'}) · {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/portal/admin-requests"
                      className="text-xs font-semibold text-amber-600 hover:underline bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100/50 hover:bg-amber-100/80 transition-colors"
                    >
                      처리하기
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  대기 중인 자원 요청이 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 최근 자산 배정 현황 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#020617]">최근 자산 배정 현황</h3>
              <Link
                href="/dashboard/assets/history"
                className="text-sm font-semibold text-[#00cfc1] hover:text-[#00a89a] flex items-center gap-1 transition-colors"
              >
                전체 이력 보기 <ArrowRight size={16} />
              </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">자산 정보</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">배정 대상자</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">부서</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">배정 일자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {recentAssignments && recentAssignments.length > 0 ? (
                    recentAssignments.map((asset) => (
                      <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-semibold text-[#020617]">{asset.name}</div>
                          <div className="text-xs text-gray-400">{asset.serial_number}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-[#020617]">
                          {(asset.employees as any) ? (
                            <EmployeeResourcesModal
                              employeeId={(asset.employees as any).id}
                              employeeName={(asset.employees as any).name}
                              employeeDept={(asset.employees as any).department}
                              employeeRole={(asset.employees as any).role_title}
                            />
                          ) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {(asset.employees as any)?.department || '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                          {asset.assigned_at ? new Date(asset.assigned_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                        최근 배정된 자산이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* 오른쪽 1열: SaaS 서비스별 라이선스 사용률 차트 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#020617]">라이선스 사용률</h3>
            <Link
              href="/dashboard/saas/usage"
              className="text-sm font-semibold text-[#00cfc1] hover:text-[#00a89a] flex items-center gap-1 transition-colors"
            >
              상세 보기 <ArrowRight size={16} />
            </Link>
          </div>

          <div className="space-y-4">
            {saasData && saasData.length > 0 ? (
              saasData.map((s: any) => {
                const used = s.used_licenses || 0;
                const total = s.total_licenses || 0;
                const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                const remaining = Math.max(0, total - used);
                const isWarning = remaining <= (s.warning_threshold || 5);

                const price = s.price_per_license || 0;
                const cycle = s.billing_cycle || 'monthly';
                let displayCost = used * price;
                let displayLabel = '월';
                if (cycle === 'yearly') {
                  displayCost = Math.round((used * price) / 12);
                  displayLabel = '월 환산';
                } else if (cycle === 'perpetual') {
                  displayLabel = '구매 총액';
                }

                return (
                  <div key={s.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#020617]">{s.name}</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${s.license_type === 'SW' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                            {s.license_type === 'SW' ? 'SW' : 'SaaS'}
                          </span>
                          <span className="text-[8px] text-gray-400 font-medium">({cycle === 'monthly' ? '월' : cycle === 'yearly' ? '연' : '영구'})</span>
                        </div>
                        <span className="text-xs text-gray-400">{displayLabel} {displayCost.toLocaleString()}원</span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        {used}/{total}개
                        {isWarning && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-bold">
                            부족 경고
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${isWarning ? 'bg-amber-500' : 'bg-[#00cfc1]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">등록된 SaaS 서비스가 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {/* 상세 영역 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* IT 자산 카테고리별 분포 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#020617]">IT 자산 유형별 분포</h3>
            <Link
              href="/dashboard/assets/inventory"
              className="text-sm font-semibold text-[#00cfc1] hover:text-[#00a89a] flex items-center gap-1 transition-colors"
            >
              상세 보기 <ArrowRight size={16} />
            </Link>
          </div>
          <div className="space-y-3">
            {Object.entries(categoryStats).length > 0 ? (
              Object.entries(categoryStats).map(([cat, stat]) => {
                const pct = stat.total > 0 ? Math.round((stat.assigned / stat.total) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-[#020617]">{cat}</span>
                      <span className="text-xs text-gray-400">배정 {stat.assigned}/{stat.total}대 ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-[#3B82F6] transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">자산 데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 주의 필요 자원 리스트 (lg:col-span-2) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#020617] flex items-center gap-2">
              주의 필요 자원
              {criticalCount > 0 && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#EF4444] animate-pulse">
                  CRITICAL
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-400 font-medium">퇴사자 미회수 자원 현황</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {criticalList && criticalList.length > 0 ? (
              criticalList.map((emp) => (
                <div
                  key={emp.id}
                  className="p-4 border border-red-100 bg-red-50/5 rounded-xl hover:bg-red-50/20 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1.5">
                        <EmployeeResourcesModal
                          employeeId={emp.id}
                          employeeName={emp.name}
                          employeeDept={emp.department}
                          employeeRole={emp.role_title}
                        />
                        <span className="text-xs text-gray-400">({emp.department || '미지정'})</span>
                      </div>
                      <span className="text-[10px] text-[#EF4444] bg-red-50 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        회수 대기
                      </span>
                    </div>

                    <div className="text-xs text-gray-505 space-y-2">
                      <p className="flex items-center gap-1 text-gray-400">
                        <Calendar size={12} />
                        퇴사일: {emp.eventDate ? new Date(emp.eventDate).toLocaleDateString() : '미정'}
                      </p>

                      {/* 미회수 IT 자산 목록 */}
                      {emp.assets && emp.assets.length > 0 ? (
                        <div className="space-y-1 bg-blue-50/20 p-2 rounded-lg border border-blue-100/50">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
                            <Monitor size={10} />
                            <span>IT 자산 ({emp.assets.length}대)</span>
                          </div>
                          <p className="text-[11px] text-gray-600 truncate">
                            {emp.assets.map((a: any) => a.name).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">반납할 IT 자산 없음</p>
                      )}

                      {/* 미회수 소프트웨어(SaaS) 목록 */}
                      {emp.saas && emp.saas.length > 0 ? (
                        <div className="space-y-1 bg-emerald-50/20 p-2 rounded-lg border border-emerald-100/50">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <Cloud size={10} />
                            <span>소프트웨어 ({emp.saas.length}개)</span>
                          </div>
                          <p className="text-[11px] text-gray-600 truncate">
                            {emp.saas.map((s: any) => s.saas_services?.name).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">회수할 소프트웨어 없음</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dashed border-red-100 flex justify-end">
                    <Link
                      href="/dashboard/hr-events/offboarding"
                      className="text-xs font-semibold text-[#EF4444] hover:underline flex items-center gap-1"
                    >
                      회수 처리하러 가기 <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-12 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                주의 또는 미회수 자원이 없습니다.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* IT 자산 재고 부족 경고 배너 (최하단 하강) */}
      {stockWarnings.length > 0 && (
        <div className="p-4.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>IT 자산 재고 부족 경고 ({stockWarnings.length}건)</span>
          </div>
          <p className="text-xs text-amber-700">다음 카테고리의 미배정(즉시 지급 가능) 재고가 임계값 이하로 부족합니다. 신규 장비 입고 또는 자원 회수 처리를 검토해 주세요.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-1">
            {stockWarnings.map((warn) => (
              <div key={warn.category} className="bg-white/90 p-2.5 rounded-lg border border-amber-100 flex justify-between items-center text-xs shadow-sm">
                <span className="font-bold text-gray-700">{warn.category}</span>
                <span className="font-semibold text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-full">
                  재고 {warn.unassigned}대 남음
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}