"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  KeyRound,
  LogOut,
  Menu,
  Pill,
  Rows3,
  Stethoscope,
  UserRound,
  X,
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

/**
 * Destinos que en escritorio viven en las píldoras de la cabecera (`NavPills`,
 * oculta por debajo de `md`). Sin esto quedaban inalcanzables en móvil: no
 * están en `ITEMS` y la cabecera no los dibuja.
 */
const SECONDARY_ITEMS: Item[] = [
  { href: "/catalogo", label: "CATÁLOGO", icon: <BookOpen className="h-4 w-4" aria-hidden="true" /> },
  {
    href: "/farmaceuticos",
    label: "FARMACÉUTICOS",
    icon: <UserRound className="h-4 w-4" aria-hidden="true" />,
  },
  {
    href: "/prescriptores",
    label: "PRESCRIPTORES",
    icon: <Stethoscope className="h-4 w-4" aria-hidden="true" />,
  },
  { href: "/historico", label: "HISTÓRICO", icon: <Archive className="h-4 w-4" aria-hidden="true" /> },
];

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrador",
  pharmacist: "Farmacéutico",
  auditor: "Consulta / Auditoría",
};

// El contorno global de foco es gris oscuro; sobre el azul marino de la barra
// resultaba invisible, así que aquí se fuerza uno claro.
const FOCUS_CLARO =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300";

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: Item;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
        FOCUS_CLARO,
        active
          ? "border-blue-700 bg-blue-800 text-white"
          : "border-blue-900/50 bg-blue-950/10 text-blue-50 hover:bg-blue-900/30",
      ].join(" ")}
    >
      <span className={active ? "text-white" : "text-blue-200"}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ authMode, user }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleItems = ITEMS.filter(
    (item) => !item.administratorOnly || user?.role === "administrator" || authMode === "basic",
  );

  // El cierre al navegar lo hace cada enlace con `onNavigate`; hacerlo también
  // desde un efecto sobre `pathname` solo añadía un render en cascada.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const contenido = (
    <div className="p-3">
      <div className="mb-3 flex items-start justify-between gap-2 rounded-2xl border border-blue-900/60 bg-blue-900/30 px-3 py-3 shadow-sm">
        <div>
          <div className="text-xs font-semibold tracking-wide text-blue-200">MENÚ</div>
          <div className="mt-1 text-sm font-semibold text-white">HOSPITAL DE HEREDIA</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          className={`rounded-lg p-1 text-blue-100 hover:bg-blue-900 md:hidden ${FOCUS_CLARO}`}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Secciones principales" className="space-y-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>
      <nav
        aria-label="Mantenimiento"
        className="mt-5 space-y-2 border-t border-blue-900 pt-4 md:hidden"
      >
        <p className="px-1 pb-1 text-xs font-semibold tracking-wide text-blue-200">MANTENIMIENTO</p>
        {SECONDARY_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>
      {user ? (
        <div className="mt-5 border-t border-blue-900 pt-4">
          <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
          <p className="truncate text-xs text-blue-200">{user.email}</p>
          {/* Era `text-blue-300` sobre `blue-950`: 1.98:1, por debajo del mínimo. */}
          <p className="mt-1 text-xs font-semibold text-blue-100">
            {ROLE_LABELS[user.role] ?? user.role}
          </p>
          {/* `/cuenta` existía pero no estaba enlazada desde ninguna
              navegación: solo se llegaba si el sistema te forzaba a ella. */}
          <Link
            href="/cuenta"
            onClick={() => setOpen(false)}
            aria-current={pathname === "/cuenta" ? "page" : undefined}
            className={`mt-3 flex items-center gap-2 rounded-xl border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-900 ${FOCUS_CLARO}`}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            CAMBIAR CONTRASEÑA
          </Link>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className={`flex w-full items-center gap-2 rounded-xl border border-blue-800 px-3 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-900 ${FOCUS_CLARO}`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              CERRAR SESIÓN
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Escritorio: en el flujo, como estaba. */}
      <aside className="hidden w-56 shrink-0 border-r border-blue-950 bg-blue-950 text-blue-50 print:hidden md:block">
        <div className="sticky top-0">{contenido}</div>
      </aside>

      {/* Móvil: la barra medía 224 px fijos y se comía el 57 % de un teléfono de
          390 px. Ahora es un panel lateral tras un botón. La barra va en el
          flujo, no flotando, para no taparle el título a la cabecera de página. */}
      <div className="flex items-center gap-3 border-b border-blue-900 bg-blue-950 px-3 py-2 text-white print:hidden md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="menu-lateral"
          className={`inline-flex items-center gap-2 rounded-xl border border-blue-800 px-3 py-2 text-sm font-semibold ${FOCUS_CLARO}`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          MENÚ
        </button>
        <span className="truncate text-sm font-semibold">HOSPITAL DE HEREDIA</span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 print:hidden md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            id="menu-lateral"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-blue-950 bg-blue-950 text-blue-50 shadow-xl"
          >
            {contenido}
          </div>
        </div>
      ) : null}
    </>
  );
}
