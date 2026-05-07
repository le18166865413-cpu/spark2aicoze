"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Sparkles } from "lucide-react";
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
  const [siteName, setSiteName] = useState("SparkAI");

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.siteName) setSiteName(data.siteName);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-[72px] items-center px-4 md:px-6 mx-auto">
        {/* Logo + Site Name */}
        <Link href="/" className="mr-4 sm:mr-8 flex items-center space-x-2 shrink-0">
          <div className="bg-primary/15 rounded-lg p-1.5 ring-1 ring-primary/40">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-lg">{siteName}</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center space-x-2 text-sm font-medium flex-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-full transition-all px-4 py-2",
                  isActive
                    ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
          {/* Mobile: 广场 button */}
          <Button
            asChild
            variant={pathname === "/" ? "default" : "outline"}
            size="sm"
            className={cn(
              "sm:hidden rounded-md text-xs font-semibold h-8",
              pathname === "/"
                ? ""
                : "border-primary/30 text-primary hover:bg-primary/10"
            )}
          >
            <Link href="/">
              <Home className="h-3.5 w-3.5 mr-1" />
              广场
            </Link>
          </Button>

          {/* Mobile: 开始创作 button */}
          <Button
            asChild
            size="sm"
            className="sm:hidden rounded-md text-xs font-semibold h-8 shadow-[0_0_12px_rgba(34,197,94,0.2)] hover:shadow-[0_0_20px_rgba(34,197,94,0.35)] transition-all"
          >
            <Link href="/create">
              <Plus className="h-3.5 w-3.5 mr-1" />
              开始创作
            </Link>
          </Button>

          {/* Desktop: 开始创作 button */}
          <Button
            asChild
            className="hidden sm:inline-flex font-bold rounded-full px-6 shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all"
          >
            <Link href="/create">开始创作</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
