import { MedicamentosPanel } from "@/components/MedicamentosPanel";
import { NavPills } from "@/components/NavPills";
import { Button } from "@/components/ui/Button";
import { Archive, BookOpen, Pill, Stethoscope, UserRound } from "lucide-react";

export default function MedicamentosPage() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-500">HOSPITAL DE DÍA</div>
            <h1 className="text-lg font-semibold">MEDICAMENTOS</h1>
          </div>
          <div className="flex items-center gap-3">
            <NavPills
              items={[
                { href: "/catalogo", label: "CATÁLOGO", icon: <BookOpen className="h-4 w-4" aria-hidden="true" /> },
                { href: "/medicamentos", label: "MEDICAMENTOS", icon: <Pill className="h-4 w-4" aria-hidden="true" /> },
                { href: "/farmaceuticos", label: "FARMACÉUTICOS", icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
                { href: "/prescriptores", label: "PRESCRIPTOR", icon: <Stethoscope className="h-4 w-4" aria-hidden="true" /> },
                { href: "/historico", label: "HISTÓRICO", icon: <Archive className="h-4 w-4" aria-hidden="true" /> },
              ]}
            />
            <Button variant="secondary" className="py-1.5">
              CERRAR SESIÓN
            </Button>
          </div>
        </div>
      </header>
      <MedicamentosPanel />
    </>
  );
}

