import React from 'react';
import { checkAssetPermissionOrRedirect } from '@/lib/supabase/server';

export default async function AssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAssetPermissionOrRedirect();
  return <>{children}</>;
}
