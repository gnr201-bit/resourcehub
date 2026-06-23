import React from 'react';
import { checkHRPermissionOrRedirect } from '@/lib/supabase/server';

export default async function HrEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkHRPermissionOrRedirect();
  return <>{children}</>;
}
