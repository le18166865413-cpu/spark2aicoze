import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { DynamicTitle } from '@/components/DynamicTitle';

export const metadata: Metadata = {
  title: 'SparkAI - 智能海报生成器',
  description: 'AI 驱动的海报生成与展示平台',
};

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
