import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import type { UserDTO } from "@shared/types/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { cn } from "@shared/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface HolderSearchDropdownProps {
  value: string;
  onChange: (userId: string) => void;
  onResolveUser?: (userId: string) => Promise<UserDTO | null>;
  error?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  onSearch: (query: string) => Promise<UserDTO[]>;
}

export function HolderSearchDropdown({
  value,
  onChange,
  error,
  onResolveUser,
  searchPlaceholder,
  noResultsText,
  onSearch,
}: HolderSearchDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  // onSearch is a fresh closure every render (it's built inline at call sites);
  // depending on it in the effect below would refire on every keystroke.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  const selectedUser = results.find((u) => u.id === value) ?? null;

  useEffect(() => {
    if (!debouncedQuery) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    onSearchRef
      .current(debouncedQuery)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (onResolveUser && value && !selectedUser) {
      onResolveUser(value).then((user) => {
        if (user) {
          setResults((prev) => (prev.find((u) => u.id === user.id) ? prev : [user, ...prev]));
        }
      });
    }
  }, [value, selectedUser, onResolveUser]);

  const placeholder = searchPlaceholder ?? t("cred.field.holderSearch");
  const noResults = noResultsText ?? t("cred.field.noSearchResults");

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          tabIndex={0}
          className={cn(
            "flex w-full items-center rounded-xl border px-4 py-3 text-left shadow-sm transition-all",
            "bg-gray-50 text-sm",
            error
              ? "border-error"
              : "border-gray-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-gold focus:outline-none",
          )}
        >
          {selectedUser ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <UserAvatar user={selectedUser} size="sm" className="shrink-0" />
              <span className="truncate text-sm font-medium text-navy">
                {selectedUser.name}
                {selectedUser.number ? ` · ${selectedUser.number}` : ""}
              </span>
            </div>
          ) : (
            <span className="flex-1 text-gray-400">{placeholder}</span>
          )}
          <ChevronDown
            className={cn(
              "ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) max-w-md p-0"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              // Clear stale results immediately on empty input rather than in
              // the debounced fetch effect, so we never call setState from an
              // unconditional effect body.
              if (!next.trim()) setResults([]);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={placeholder}
            className="h-11 w-full bg-transparent text-sm text-navy outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("cred.submit.loading")}
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-gray-400">{noResults}</div>
          )}
          {!loading &&
            results.map((user) => {
              const isSelected = user.id === value;
              return (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => onChange(user.id)}
                  className={cn(
                    "flex items-center gap-3",
                    isSelected && "bg-navy/5 font-semibold",
                  )}
                >
                  <UserAvatar user={user} size="md" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-navy">
                      {user.name ?? user.email}
                    </div>
                    <div className="text-xs text-gray-500">{user.number}</div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />}
                </DropdownMenuItem>
              );
            })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
