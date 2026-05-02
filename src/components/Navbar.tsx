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
        <Link href="/" className="mr-8 flex items-center space-x-2">
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
                  "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                  isActive
                    ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="hover:text-primary">
            <Compass className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all">
            <Link href="/create">开始创作</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
