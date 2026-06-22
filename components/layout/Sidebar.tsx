"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Server,
  Cloud,
  UserCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const MENU_ITEMS = [
  { name: '통합 대시보드', icon: LayoutDashboard, path: '/dashboard' },
  {
    name: '인적자원 관리',
    icon: Users,
    path: '/dashboard/hr-events',
    subItems: [
      { name: '입사 자원 배부', path: '/dashboard/hr-events/onboarding' },
      { name: '퇴사 자원 회수', path: '/dashboard/hr-events/offboarding' },
      { name: 'HR 정보 추가 지원 할당', path: '/dashboard/hr-events/transfer' },
    ]
  },
  {
    name: 'IT 자산 관리',
    icon: Server,
    path: '/dashboard/assets',
    subItems: [
      { name: '자산 현황', path: '/dashboard/assets/inventory' },
      { name: '배정 및 회수 이력', path: '/dashboard/assets/history' },
    ]
  },
  {
    name: '소프트웨어 현황',
    icon: Cloud,
    path: '/dashboard/saas',
    subItems: [
      { name: '사용 현황 및 등록', path: '/dashboard/saas/usage' },
      { name: '계정 프로비저닝 관리', path: '/dashboard/saas/provisioning' },
    ]
  },
  {
    name: '직원 포털',
    icon: UserCircle,
    path: '/dashboard/portal',
    subItems: [
      { name: '내 자원 조회', path: '/dashboard/portal/my-resources' },
      { name: '자원 요청 및 반납', path: '/dashboard/portal/requests' },
      { name: '자원 요청 관리 (관리자)', path: '/dashboard/portal/admin-requests' },
    ]
  },
  {
    name: '시스템 설정',
    icon: Settings,
    path: '/dashboard/settings',
    subItems: [
      { name: 'HR 시스템 연동', path: '/dashboard/settings/hr-sync' },
      { name: '계정 권한 설정', path: '/dashboard/settings/roles' },
      { name: '자원 템플릿 설정', path: '/dashboard/settings/templates' },
      { name: '동기화 로그 및 알림', path: '/dashboard/settings/logs' },
      { name: '경고 및 알림 규칙 설정', path: '/dashboard/settings/rules' },
    ]
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userRoleTitle, setUserRoleTitle] = useState<string>('');

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          return;
        }

        if (user.email === 'admin@company.com') {
          setIsAdmin(true);
          setUserEmail('admin@company.com');
          setUserName('시스템 관리자');
          setUserRoleTitle('시스템관리자');
          return;
        }

        const { data: employee } = await supabase
          .from('employees')
          .select('name, role_title')
          .eq('email', user.email)
          .single();

        const isUserAdmin = employee && (employee.role_title === '시스템관리자' || employee.role_title.includes('관리자'));
        setIsAdmin(!!isUserAdmin);
        setUserEmail(user.email || '');
        setUserName(employee?.name || user.email?.split('@')[0] || '사용자');
        setUserRoleTitle(employee?.role_title || '임직원');
      } catch (err) {
        console.error('Role check error:', err);
        setIsAdmin(false);
      }
    };
    checkRole();
  }, []);

  const handleSignOut = async () => {
    const confirmLogout = window.confirm('로그아웃 하시겠습니까?');
    if (!confirmLogout) return;
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  if (isAdmin === null) {
    return (
      <aside className="w-64 h-screen bg-[#020617] text-white flex flex-col fixed left-0 top-0 overflow-y-auto">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-800">
          <div className="w-8 h-8 bg-[#00cfc1] rounded flex items-center justify-center text-[#020617] font-bold">
            R
          </div>
          <span className="text-xl font-bold tracking-tight">Resourcehub</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-[#00cfc1]" size={24} />
        </div>
      </aside>
    );
  }

  // 일반 직원은 '직원 포털'의 '내 자원 조회', '자원 요청 및 반납'만 노출
  const filteredMenuItems = MENU_ITEMS.map(item => {
    if (isAdmin) {
      return item;
    }

    if (item.name === '직원 포털') {
      return {
        ...item,
        subItems: item.subItems?.filter(sub => sub.name !== '자원 요청 관리 (관리자)')
      };
    }

    return null;
  }).filter(Boolean) as typeof MENU_ITEMS;

  return (
    <aside className="w-64 h-screen bg-[#020617] text-white flex flex-col justify-between fixed left-0 top-0 border-r border-gray-800">
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-800">
          <div className="w-8 h-8 bg-[#00cfc1] rounded flex items-center justify-center text-[#020617] font-bold">
            R
          </div>
          <span className="text-xl font-bold tracking-tight">Resourcehub</span>
        </div>

        <div className="p-4">
          <p className="text-xs text-gray-400 font-semibold mb-4 px-2 uppercase">Menu</p>
          <nav className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname?.startsWith(item.path));
              const isExpanded = openMenus[item.name] || isActive;
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <div key={item.name} className="flex flex-col space-y-1 mb-1">
                  <div
                    onClick={() => hasSubItems ? toggleMenu(item.name) : null}
                    className={`flex items-center justify-between px-3 py-3 rounded-lg transition-colors cursor-pointer ${isActive && !hasSubItems
                      ? 'bg-[#00cfc1] text-[#020617] font-medium'
                      : 'text-gray-300 hover:bg-[#0f1729] hover:text-white'
                      }`}
                  >
                    <Link href={hasSubItems ? '#' : item.path} className="flex items-center space-x-3 flex-1">
                      <Icon size={20} className={isActive && !hasSubItems ? 'text-[#020617]' : 'text-gray-400'} />
                      <span className={isActive ? 'font-medium text-white' : ''}>{item.name}</span>
                    </Link>
                    {hasSubItems && (
                      <button className="text-gray-400 hover:text-white">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                  </div>

                  {/* 서브 메뉴 렌더링 */}
                  {hasSubItems && isExpanded && (
                    <div className="flex flex-col space-y-1 pl-10 pr-2 pb-2">
                      {item.subItems!.map((subItem) => {
                        const isSubActive = pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.name}
                            href={subItem.path}
                            className={`text-sm py-2 px-3 rounded-md transition-colors flex items-center before:content-[''] before:w-1 before:h-1 before:rounded-full before:mr-3 ${isSubActive
                              ? 'text-[#00cfc1] bg-[#00cfc1]/10 font-medium before:bg-[#00cfc1]'
                              : 'text-gray-400 hover:text-white hover:bg-[#0f1729] before:bg-gray-600'
                              }`}
                          >
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 하단 사용자 정보 및 로그아웃 */}
      <div className="p-4 border-t border-gray-800 bg-[#070d19] flex flex-col space-y-3 shrink-0">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#00cfc1]/10 flex items-center justify-center text-[#00cfc1] font-bold text-sm">
            {userName ? userName.substring(0, 2) : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{userName || '사용자'}</p>
            <p className="text-[11px] text-gray-400 truncate">{userRoleTitle || '임직원'}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5 border border-red-500/20 shadow-sm"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}