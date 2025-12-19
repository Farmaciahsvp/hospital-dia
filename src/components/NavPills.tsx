"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function NavPills({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="hidden md:block">
      <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 shadow-sm">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                "focus-visible:outline-blue-600",
                active
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-zinc-700 hover:bg-white hover:text-blue-700",
              )}
            >
              <span className={cn("h-4 w-4", active ? "text-blue-600" : "text-zinc-600")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

