'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/': '',  // Use default title
  '/create': '创作中心',
  '/my-works': '我的作品',
  '/stats': '使用统计',
  '/login': '登录',
};

export function DynamicTitle() {
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        const siteName = data.siteName || 'SparkAI';
        const siteTitle = data.siteTitle || 'SparkAI - 智能海报生成器';
        const pageTitle = PAGE_TITLES[pathname];

        if (pageTitle) {
          document.title = `${pageTitle} - ${siteName}`;
        } else if (pathname.startsWith('/admin')) {
          // Admin pages
          const adminPage = pathname.split('/')[2];
          const adminTitles: Record<string, string> = {
            '': '管理后台',
            login: '管理员登录',
            settings: '网站设置',
            'api-tokens': 'API 令牌',
            theme: '主题配色',
            storage: '图片存储',
            import: '任务导入',
            users: '用户管理',
            creation: '创作配置',
          };
          const adminTitle = adminTitles[adminPage] || '管理后台';
          document.title = `${adminTitle} - ${siteName}`;
        } else {
          document.title = siteTitle;
        }
      })
      .catch(() => {});
  }, [pathname]);

  return null;
}
