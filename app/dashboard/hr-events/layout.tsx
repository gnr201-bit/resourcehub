import React from 'react';
import { checkAdminOrRedirect } from '@/lib/supabase/server';

export default async function HrEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAdminOrRedirect();
  return <>{children}</>;
}
