"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LogOut,
  Pill,
  Rows3,
} from "lucide-react";
import type { ReactNode } from "react";

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  administratorOnly?: boolean;
};

type SidebarProps = {
  authMode: string | null;
  user: {
    role: string;
    displayName: string;
    email: string;
  } | null;
};

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
    administratorOnly: true,
  },
  {
    href: "/estadistica",
    label: "ESTADÍSTICA",
    icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  },
];

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrador",
  pharmacist: "Farmacéutico",
  auditor: "Consulta / Auditoría",
};

export function Sidebar({ authMode, user }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = ITEMS.filter(
    (item) => !item.administratorOnly || user?.role === "administrator" || authMode === "basic",
  );

  return (
    <aside className="w-56 shrink-0 border-r border-blue-950 bg-blue-950 text-blue-50 print:hidden">
      <div className="sticky top-0 p-3">
        <div className="mb-3 rounded-2xl border border-blue-900/60 bg-blue-900/30 px-3 py-3 shadow-sm">
          <div className="text-xs font-semibold tracking-wide text-blue-200">MENÚ</div>
          <div className="mt-1 text-sm font-semibold text-white">HOSPITAL DE HEREDIA</div>
        </div>
        <nav className="space-y-2">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
                  active
                    ? "border-blue-700 bg-blue-800 text-white"
                    : "border-blue-900/50 bg-blue-950/10 text-blue-50 hover:bg-blue-900/30",
                ].join(" ")}
              >
                <span className={active ? "text-white" : "text-blue-200"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {user ? (
          <div className="mt-5 border-t border-blue-900 pt-4">
            <p className="truncate text-sm font-semibold text-white">
              {user.displayName}
            </p>
            <p className="truncate text-xs text-blue-200">{user.email}</p>
            <p className="mt-1 text-xs font-semibold text-blue-300">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
            <form action="/auth/signout" method="post" className="mt-3">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-xl border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-900"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                CERRAR SESIÓN
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
