import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// 사내 보안 프록시망 등으로 인해 발생하는 self-signed certificate SSL 핸드쉐이크 에러 우회 설정
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트 환경에서 setAll 호출 시 발생하는 에러 무시
          }
        },
      },
    }
  );
}

export async function checkAdminOrRedirect() {
  const supabase = await createClient();
  let user = null;
  let isAdmin = false;
  let isLoginRequired = false;
  
  try {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();

    if (error || !currentUser) {
      isLoginRequired = true;
    } else {
      user = currentUser;
      if (user.email === 'admin@company.com') {
        isAdmin = true;
      } else {
        const { data: employee } = await supabase
          .from('employees')
          .select('role_title')
          .eq('email', user.email)
          .maybeSingle();

        isAdmin = !!(employee && (employee.role_title === '시스템관리자' || employee.role_title.includes('관리자')));
      }
    }
  } catch (err) {
    console.error('Catch error in checkAdminOrRedirect check:', err);
    isLoginRequired = true;
  }

  if (isLoginRequired) {
    redirect('/login');
  }

  if (!isAdmin) {
    redirect('/dashboard/portal/my-resources');
  }

  return user;
}

export async function checkAssetPermissionOrRedirect() {
  const supabase = await createClient();
  let user = null;
  let hasPermission = false;
  let isLoginRequired = false;
  
  try {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();

    if (error || !currentUser) {
      isLoginRequired = true;
    } else {
      user = currentUser;
      if (user.email === 'admin@company.com') {
        hasPermission = true;
      } else {
        const { data: employee } = await supabase
          .from('employees')
          .select('department, role_title')
          .eq('email', user.email)
          .maybeSingle();

        const isAdmin = employee && (employee.role_title === '시스템관리자' || employee.role_title.includes('관리자'));
        const isITTeam = employee && employee.department === 'IT운영팀';
        
        if (isAdmin || isITTeam) {
          hasPermission = true;
        }
      }
    }
  } catch (err) {
    console.error('Catch error in checkAssetPermission check:', err);
    isLoginRequired = true;
  }

  if (isLoginRequired) {
    redirect('/login');
  }

  if (!hasPermission) {
    redirect('/dashboard/portal/my-resources');
  }

  return user;
}

export async function checkHRPermissionOrRedirect() {
  const supabase = await createClient();
  let user = null;
  let hasPermission = false;
  let isLoginRequired = false;
  
  try {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();

    if (error || !currentUser) {
      isLoginRequired = true;
    } else {
      user = currentUser;
      if (user.email === 'admin@company.com') {
        hasPermission = true;
      } else {
        const { data: employee } = await supabase
          .from('employees')
          .select('department, role_title')
          .eq('email', user.email)
          .maybeSingle();

        const isAdmin = employee && (employee.role_title === '시스템관리자' || employee.role_title.includes('관리자'));
        const isHRTeam = employee && employee.department === '인사팀';
        
        if (isAdmin || isHRTeam) {
          hasPermission = true;
        }
      }
    }
  } catch (err) {
    console.error('Catch error in checkHRPermission check:', err);
    isLoginRequired = true;
  }

  if (isLoginRequired) {
    redirect('/login');
  }

  if (!hasPermission) {
    redirect('/dashboard/portal/my-resources');
  }

  return user;
}

