import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn.ts";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      aria-invalid={error || props["aria-invalid"] || undefined}
      className={cn(
        "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15",
        error &&
          "border-red-500 bg-red-50/40 text-red-900 placeholder:text-red-300 focus:border-red-600 focus:ring-red-500/20",
        className,
      )}
      {...props}
    />
  );
}
