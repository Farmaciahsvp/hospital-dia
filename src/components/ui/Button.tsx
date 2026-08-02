"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ variant = "secondary", className, ...props }, ref) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";
  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-blue-600 text-white shadow-sm hover:bg-blue-500 hover:shadow focus-visible:outline-blue-600",
    secondary:
      "border border-zinc-200 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 hover:shadow focus-visible:outline-blue-600",
    subtle:
      "bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 hover:shadow focus-visible:outline-blue-600",
    danger:
      "bg-rose-600 text-white shadow-sm hover:bg-rose-500 hover:shadow focus-visible:outline-rose-600",
  };
  return <button ref={ref} className={cn(base, styles[variant], className)} {...props} />;
});
