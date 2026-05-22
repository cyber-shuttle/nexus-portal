"use client";

import { useDebounce } from "@shared/hooks/useDebounce";
import * as React from "react";
import { cn } from "@/lib/utils";

export type ProjectAutocompletePick = {
  id: string;
  originated_id: string;
  title: string;
};

export type ProjectAutocompleteProps = {
  value: ProjectAutocompletePick | null;
  onChange: (next: ProjectAutocompletePick | null) => void;
  search: (q: string) => Promise<ProjectAutocompletePick[]>;
  inputId?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

export function ProjectAutocomplete({
  value,
  onChange,
  search,
  inputId,
  placeholder = "Search projects by id or title…",
  ariaLabel,
  className,
}: ProjectAutocompleteProps) {
  const [query, setQuery] = React.useState(value?.originated_id ?? "");
  const debounced = useDebounce(query, 200);
  const [results, setResults] = React.useState<ProjectAutocompletePick[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listboxId = React.useId();

  React.useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setResults([]);
      return () => {
        cancelled = true;
      };
    }
    setIsFetching(true);
    search(debounced)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, search]);

  function commit(pick: ProjectAutocompletePick) {
    onChange(pick);
    setQuery(pick.originated_id);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        className="w-56 rounded-md border bg-background px-2 py-1 text-xs"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            setOpen(true);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            const pick = results[activeIndex];
            if (pick) {
              e.preventDefault();
              commit(pick);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear selection"
          className="-translate-y-1/2 absolute top-1/2 right-1 rounded px-1 text-muted-foreground text-xs hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
        >
          ×
        </button>
      ) : null}
      {open && (results.length > 0 || isFetching) ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-72 overflow-auto rounded-md border bg-popover py-1 text-xs shadow-md"
        >
          {isFetching && results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          ) : null}
          {results.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "cursor-pointer px-3 py-2",
                i === activeIndex ? "bg-muted" : "hover:bg-muted/60",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(p);
              }}
            >
              <div className="font-mono">{p.originated_id}</div>
              <div className="text-muted-foreground">{p.title}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
