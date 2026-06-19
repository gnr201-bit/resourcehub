import { redirect } from 'next/navigation';

export default function Home() {
  // 기본 접속 시 로그인 페이지로 리다이렉트합니다.
  redirect('/login');
}