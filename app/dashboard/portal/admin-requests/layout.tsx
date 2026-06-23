import React from 'react';
import { checkAssetPermissionOrRedirect } from '@/lib/supabase/server';

export default async function AdminRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAssetPermissionOrRedirect();
  return <>{children}</>;
}
