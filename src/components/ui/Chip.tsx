"use client";

import { cn } from "@/lib/cn";

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-colors",
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-blue-50 hover:border-blue-200",
        className,
      )}
      {...props}
    />
  );
}
