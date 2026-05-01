import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: 'SparkAI - 智能海报生成器',
  description: 'Create professional posters with AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background font-sans selection:bg-primary selection:text-primary-foreground">
        <Navbar />
        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
