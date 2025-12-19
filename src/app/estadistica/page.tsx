import { Estadistica } from "@/components/Estadistica";
import { NavPills } from "@/components/NavPills";
import { Archive, BookOpen, Stethoscope, UserRound } from "lucide-react";

export default function EstadisticaPage() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">HOSPITAL DE HEREDIA</div>
            <h1 className="text-lg font-semibold">ESTADÍSTICA</h1>
          </div>
          <div className="flex items-center gap-3">
            <NavPills
              items={[
                { href: "/catalogo", label: "CATÁLOGO", icon: <BookOpen className="h-4 w-4" aria-hidden="true" /> },
                { href: "/farmaceuticos", label: "FARMACÉUTICOS", icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
                { href: "/prescriptores", label: "PRESCRIPTOR", icon: <Stethoscope className="h-4 w-4" aria-hidden="true" /> },
                { href: "/historico", label: "HISTÓRICO", icon: <Archive className="h-4 w-4" aria-hidden="true" /> },
              ]}
            />
          </div>
        </div>
      </header>
      <Estadistica />
    </>
  );
}

