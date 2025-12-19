"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardList, Pill, Rows3 } from "lucide-react";
import type { ReactNode } from "react";

type Item = { href: string; label: string; icon: ReactNode };

const ITEMS: Item[] = [
  { href: "/", label: "AGENDA", icon: <Rows3 className="h-4 w-4" aria-hidden="true" /> },
  {
    href: "/calendario",
    label: "CALENDARIO",
    icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/registro-pacientes",
    label: "PACIENTES",
    icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/medicamentos",
    label: "MEDICAMENTOS",
    icon: <Pill className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/estadistica",
    label: "ESTADÍSTICA",
    icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white/90 backdrop-blur print:hidden">
      <div className="sticky top-0 p-3">
        <div className="mb-3 rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm">
          <div className="text-xs font-semibold tracking-wide text-blue-700">MENÚ</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">HOSPITAL DE HEREDIA</div>
        </div>
        <nav className="space-y-2">
          {ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
                  active
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-blue-50/40",
                ].join(" ")}
              >
                <span className={active ? "text-blue-700" : "text-zinc-600"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
