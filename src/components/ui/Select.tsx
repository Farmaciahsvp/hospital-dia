"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm",
        "focus-visible:outline-blue-600 focus-visible:ring-2 focus-visible:ring-blue-200",
        className,
      )}
      {...props}
    />
  );
});

