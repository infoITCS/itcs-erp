import { useEffect, useMemo, useRef, useState } from "react";
import type { NavItem } from "@/app/router/nav.tsx";
import { NavIcon } from "./NavIcon.tsx";

export function CommandPalette({
  open,
  items,
  onClose,
  onSelect,
}: {
  open: boolean;
  items: NavItem[];
  onClose: () => void;
  onSelect: (item: NavItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.slice(0, 8);
    }
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        const item = results[activeIndex];
        if (item) {
          onSelect(item);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, results, activeIndex, onClose, onSelect]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/60 px-4 pt-20 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search modules"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0 text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a module..."
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-100"
          >
            ESC
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-slate-400">No modules found</li>
          ) : (
            results.map((item, index) => (
              <li key={item.path}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onSelect(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    index === activeIndex ? "bg-brand-50 text-brand-800" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      index === activeIndex
                        ? "bg-brand-100 text-brand-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <NavIcon to={item.path} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{item.group}</span>
                  </span>
                  {index === activeIndex ? (
                    <span className="shrink-0 text-[10px] font-semibold text-brand-500">ENTER</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
