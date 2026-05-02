'use client';

import React, { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import SidebarLayout from '../../components/SidebarLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <SidebarLayout
      onCollapse={setCollapsed}
      mobileMenuOpen={mobileMenuOpen}
      onMobileMenuChange={setMobileMenuOpen}
    >
      {children}
    </SidebarLayout>
  );
}