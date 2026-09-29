import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn.ts";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500",
        className,
      )}
      {...props}
    />
  );
}
