import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { DynamicTitle } from '@/components/DynamicTitle';
import { getSiteConfig } from '@/lib/site-config';

// Start GrsAI dashboard auto sync cron (server-side only)
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
  if (!(globalThis as Record<string, unknown>).__grsaiCronStarted) {
    (globalThis as Record<string, unknown>).__grsaiCronStarted = true;
    // Dynamic import to avoid bundling issues
    import('@/lib/grsai-cron').then(({ startGrsaiCron }) => {
      startGrsaiCron();
    }).catch(console.error);
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: {
      default: config.siteTitle,
      template: `%s - ${config.siteName}`,
    },
    description: config.siteDescription,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased min-h-screen bg-background font-sans selection:bg-primary selection:text-primary-foreground">
        <ThemeProvider>
          <AuthProvider>
            <DynamicTitle />
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
