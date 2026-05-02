"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Compass, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const items = [
  {
    title: "海报广场",
    href: "/",
    icon: Home,
  },
  {
    title: "创作中心",
    href: "/create",
    icon: Plus,
  },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-16 items-center px-4 md:px-6 mx-auto">
        <Link href="/" className="mr-4 sm:mr-8 flex items-center space-x-2">
          <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="hidden font-bold sm:inline-block text-lg">SparkAI</span>
        </Link>
        <nav className="flex items-center space-x-2 text-sm font-medium flex-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full transition-all",
                  "px-4 py-2",
                  "max-sm:px-2.5 max-sm:py-1.5 max-sm:text-xs",
                  isActive
                    ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="max-sm:hidden">{item.title}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
          <Button asChild size="icon" className="sm:hidden hover:text-primary h-8 w-8">
            <Link href="/create">
              <Plus className="h-4 w-4" />
              <span className="sr-only">开始创作</span>
            </Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all">
            <Link href="/create">开始创作</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
