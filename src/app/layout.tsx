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
  const showProtectedShell = authMode === "basic" || Boolean(role);

  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {showProtectedShell ? (
          <div className="min-h-screen bg-sky-50 text-zinc-900">
            <div className="flex min-h-screen">
              <Sidebar
                authMode={authMode}
                user={
                  role && displayName && email
                    ? { role, displayName, email }
                    : null
                }
              />
              <main className="min-w-0 flex-1">{children}</main>
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
