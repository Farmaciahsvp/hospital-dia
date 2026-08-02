import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { ErrorLogPanel } from "@/components/ErrorLogPanel";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hospital de Heredia – Servicio de Farmacia",
  description: "Agenda del día – Servicio de Farmacia",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const authMode = requestHeaders.get("x-app-auth-mode");
  const role = requestHeaders.get("x-app-user-role");
  const displayName = requestHeaders.get("x-app-user-name");
  const email = requestHeaders.get("x-app-user-email");
  const mustChangePassword =
    requestHeaders.get("x-app-must-change-password") === "true";
  const showProtectedShell =
    authMode === "basic" || (Boolean(role) && !mustChangePassword);

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {showProtectedShell ? (
          <div className="min-h-screen bg-sky-50 text-zinc-900">
            {/* Sin esto había que tabular por toda la barra lateral y la
                cabecera antes de llegar a la tabla del día. */}
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-blue-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
            >
              Saltar al contenido
            </a>
            {/* En columna por debajo de `md` para que la barra de menú móvil
                ocupe el ancho completo en vez de competir con el contenido. */}
            <div className="flex min-h-screen flex-col md:flex-row">
              <Sidebar
                authMode={authMode}
                user={
                  role && displayName && email
                    ? { role, displayName, email }
                    : null
                }
              />
              <main id="contenido" className="min-w-0 flex-1">
                {children}
              </main>
            </div>
            <ErrorLogPanel />
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
