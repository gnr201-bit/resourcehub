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
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('getUser error in checkAdminOrRedirect:', error);
    }

    if (!user) {
      redirect('/login');
    }

    if (user.email === 'admin@company.com') {
      return user;
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('role_title')
      .eq('email', user.email)
      .single();

    const isAdmin = employee && (employee.role_title === '시스템관리자' || employee.role_title.includes('관리자'));

    if (!isAdmin) {
      redirect('/dashboard/portal/my-resources');
    }

    return user;
  } catch (err) {
    console.error('Catch error in checkAdminOrRedirect:', err);
    redirect('/login');
  }
}

