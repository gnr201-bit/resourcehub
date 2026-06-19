import React from 'react';
import { checkAdminOrRedirect } from '@/lib/supabase/server';

export default async function AssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAdminOrRedirect();
  return <>{children}</>;
}
