import { useTranslation } from "react-i18next";
import { Check, ChevronDown, CircleDashed, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { notify } from "@shared/lib/notify";
import { useDebouncedValue } from "@shared/hooks/useDebouncedValue";
import { useState } from "react";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";
import {
  useReferenceByIds,
  useReferencePage,
  useUpsertReference,
} from "@shared/api/useReferenceData";
import { Badge } from "@ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";

interface SearchableCreateSelectBaseProps {
  resource: ReferenceResource;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  /**
   * "create" (default) POSTs a new taxonomy row when the user picks the
   * create row — Issuer+ only, since taxonomy writes are role-guarded.
   * "propose" emits the typed name via onProposeChange instead, for holders
   * submitting a credential: the name is staged on the credential and a
   * reviewer resolves it later.
   */
  mode?: "create" | "propose";
  /** The currently proposed free-text name (propose mode, single only). */
  proposed?: string;
  onProposeChange?: (name: string) => void;
  /** Proposed free-text names (propose mode, multiple only). */
  proposedNames?: string[];
  onProposedNamesChange?: (names: string[]) => void;
}

export type SearchableCreateSelectProps =
  | (SearchableCreateSelectBaseProps & {
      multiple?: false;
      value: string;
      onChange: (id: string) => void;
    })
  | (SearchableCreateSelectBaseProps & {
      multiple: true;
      value: string[];
      onChange: (ids: string[]) => void;
    });

export function SearchableCreateSelect(props: SearchableCreateSelectProps) {
  const { t } = useTranslation();
  const multiple = props.multiple === true;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  // The option list is one server-searched page, so filtering happens in SQL.
  // Debounced to avoid a request per keystroke.
  const debouncedQuery = useDebouncedValue(trimmed, 300);
  const list = useReferencePage(props.resource, { search: debouncedQuery });
  const upsert = useUpsertReference(props.resource);

  const rows = list.items;
  const selectedIds = multiple ? props.value : props.value ? [props.value] : [];

  // Chip names come from a dedicated by-id lookup, not from `rows`: a selection
  // made before the current search — or living past page 1 — is not in the
  // loaded page, and reading names from there would render bare ids.
  const selected = useReferenceByIds(props.resource, selectedIds);
  const selectedRows = selected.data ?? [];

  // The create row is gated on an EXACT match, not on result count: a partial
  // match ("Akuntansi" for "AK") must not block creating the literal string.
  // `term` is the debounced query, not `trimmed`: `rows` reflect the debounced
  // value, and mixing the two lets the label say "AK" while the click sends "AKU".
  const term = debouncedQuery;
  const hasExact = rows.some((r) => r.name.trim().toLowerCase() === term.toLowerCase());
  const showCreateRow = term.length > 0 && !list.isLoading && !hasExact;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const select = (row: ReferenceRow) => {
    // Picking a real row supersedes a proposed name for the same slot.
    if (props.mode === "propose" && !multiple) {
      props.onProposeChange?.("");
    }
    if (multiple) {
      const next = props.value.includes(row.id)
        ? props.value.filter((id) => id !== row.id)
        : [...props.value, row.id];
      props.onChange(next);
      // A real pick supersedes a proposed name for the same slot — drop any
      // proposal that now duplicates the row just selected.
      if (props.mode === "propose") {
        const current = props.proposedNames ?? [];
        const deduped = current.filter((n) => n.toLowerCase() !== row.name.toLowerCase());
        if (deduped.length !== current.length) {
          props.onProposedNamesChange?.(deduped);
        }
      }
    } else {
      props.onChange(row.id);
      close();
    }
  };

  const deselect = (id: string) => {
    if (multiple) {
      props.onChange(props.value.filter((v) => v !== id));
    } else {
      props.onChange("");
    }
  };

  const handleCreate = () => {
    const name = term;
    if (!name) return;

    // Propose mode never writes to the taxonomy: the name rides along on the
    // credential and a reviewer resolves it. Holders cannot POST here anyway.
    if (props.mode === "propose") {
      if (multiple) {
        const current = props.proposedNames ?? [];
        // Reject a proposal that duplicates a proposed OR an already-selected
        // real row by name — each slot holds one of {id, proposedName}, never
        // both for the same name.
        const isDuplicate =
          current.some((n) => n.toLowerCase() === name.toLowerCase()) ||
          selectedRows.some((r) => r.name.toLowerCase() === name.toLowerCase());
        if (isDuplicate) {
          notify.info("cred.submit.existing");
        } else {
          props.onProposedNamesChange?.([...current, name]);
        }
      } else {
        props.onProposeChange?.(name);
        // A proposed name and a picked id are mutually exclusive. Clear only
        // when a real id is currently selected — an empty value is already empty.
        if (props.value) props.onChange("");
        close();
      }
      return;
    }

    upsert.mutate(name, {
      onSuccess: (row) => {
        // The server returns the pre-existing row when the name matches
        // case-insensitively, so the canonical spelling can come back instead of what
        // was typed — the exact match may simply have been past page 1.
        if (row.name !== name) {
          notify.info("cred.submit.existing");
        }
        if (multiple) {
          if (!props.value.includes(row.id)) {
            props.onChange([...props.value, row.id]);
          }
        } else {
          props.onChange(row.id);
          close();
        }
      },
    });
  };

  const proposedList = multiple ? (props.proposedNames ?? []) : props.proposed ? [props.proposed] : [];
  // Gate on selectedIds, not selectedRows: a saved selection has an id before
  // the by-ids fetch resolves its name, and that in-flight window is not empty
  // — it's a real selection whose name hasn't loaded yet.
  const isEmpty = selectedIds.length === 0 && proposedList.length === 0;
  // A real selection whose name hasn't resolved yet is still real — gate the
  // proposed marker on the id, not on the (possibly still-loading) row.
  const hasRealSelection = selectedIds.length > 0;

  const trigger = (
    <div
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={props.label}
      aria-invalid={props.error ? true : undefined}
      aria-disabled={props.disabled}
      tabIndex={props.disabled ? -1 : 0}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-left shadow-sm transition-all",
        "bg-gray-50 text-sm text-navy",
        props.disabled && "pointer-events-none cursor-not-allowed opacity-50",
        props.error
          ? "border-error"
          : "border-gray-200 focus-within:border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-gold focus:border-transparent focus:bg-white focus:ring-2 focus:ring-gold focus:outline-none",
        props.className,
      )}
    >
      {isEmpty ? (
        <span className="flex-1 truncate text-gray-400">
          {props.placeholder ?? t("cred.submit.searchPlaceholder")}
        </span>
      ) : !multiple ? (
        // One value needs no chip — plain text, same as UnitPicker and the
        // <Select> fields beside it. Chips are reserved for multi-value. A
        // proposed (not yet real) value gets an inline marker instead: a
        // gray glyph + status text, never a chip and never gold — gold means
        // confirmed, and a proposal is the opposite of confirmed.
        <>
          {!hasRealSelection && (
            <CircleDashed className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {selectedRows[0]?.name ?? props.proposed}
          </span>
          {!hasRealSelection && (
            <span className="shrink-0 text-xs text-gray-400">{t("cred.submit.proposed")}</span>
          )}
          <button
            type="button"
            aria-label={t("cred.submit.removeSelection", {
              name: selectedRows[0]?.name ?? props.proposed,
            })}
            // Radix opens the trigger on pointerdown, before React's click
            // handler runs — stopPropagation there too, or the panel flashes
            // open on the way to clearing.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (hasRealSelection) {
                deselect(selectedIds[0]);
              } else {
                props.onProposeChange?.("");
              }
            }}
            className="shrink-0 rounded-full text-navy/60 hover:text-navy"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selectedRows.map((row) => (
            <Badge
              key={row.id}
              tone="gold"
              className="inline-flex items-center gap-1 text-xs font-medium normal-case tracking-normal"
            >
              <span className="max-w-40 truncate">{row.name}</span>
              <button
                type="button"
                aria-label={t("cred.submit.removeSelection", { name: row.name })}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  deselect(row.id);
                }}
                className="rounded-full text-navy/60 hover:text-navy"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {proposedList.map((name) => (
            <Badge
              key={`proposed:${name}`}
              tone="gray"
              className="inline-flex items-center gap-1 text-xs font-medium normal-case tracking-normal"
            >
              <CircleDashed className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="max-w-40 truncate">{name}</span>
              <span className="text-xs text-gray-400">{t("cred.submit.proposed")}</span>
              <button
                type="button"
                aria-label={t("cred.submit.removeSelection", { name })}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onProposedNamesChange?.(proposedList.filter((n) => n !== name));
                }}
                className="rounded-full text-navy/60 hover:text-navy"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <ChevronDown
        className={cn(
          "ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform",
          open && "rotate-180",
        )}
        aria-hidden="true"
      />
    </div>
  );

  const dropdown = (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setOpen(true);
        } else {
          close();
        }
      }}
    >
      <DropdownMenuTrigger asChild disabled={props.disabled}>
        {trigger}
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={props.placeholder ?? t("cred.submit.searchPlaceholder")}
            className="h-11 w-full bg-transparent text-sm text-navy outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="scrollbar-hidden max-h-72 overflow-y-auto p-1">
          {list.isLoading && (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("cred.submit.loading")}
            </div>
          )}
          {!list.isLoading && !list.isError && rows.length === 0 && !showCreateRow && (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              {t("cred.submit.emptyList")}
            </div>
          )}
          {!list.isLoading && list.isError && (
            <div className="px-3 py-6 text-center text-sm text-error">
              {t("cred.submit.loadError")}
            </div>
          )}
          {!list.isLoading &&
            rows.map((row) => {
              const isSelected = selectedIds.includes(row.id);
              // Inactive rows stay visible but unpickable — the backend rejects
              // them at issue time. An already-selected one stays clickable so
              // it can still be removed.
              const blocked = row.active === false && !isSelected;
              return (
                <DropdownMenuItem
                  key={row.id}
                  disabled={blocked}
                  // Radix closes the menu on select; multi-select must stay open
                  // so more than one row can be toggled per visit.
                  onSelect={(e) => multiple && e.preventDefault()}
                  onClick={() => select(row)}
                  className={cn(
                    "flex items-center justify-between gap-2",
                    isSelected && "bg-navy/5 font-semibold",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  {row.active === false && (
                    <span className="shrink-0 text-xs text-gray-400">
                      {t("cred.submit.inactive")}
                    </span>
                  )}
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />}
                </DropdownMenuItem>
              );
            })}
          {list.hasMore && (
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              onClick={list.loadMore}
              disabled={list.isFetchingNextPage}
              className="flex items-center justify-center gap-2 border-t border-gray-100 font-medium text-gray-500"
            >
              {list.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.loadMore")}
            </DropdownMenuItem>
          )}
        </div>
        {showCreateRow && (
          <div className="border-t border-gray-100 p-1">
            <DropdownMenuItem
              // Always prevented, not just for multi: Radix's default onSelect
              // closes the menu immediately, which would hide the disabled +
              // spinner state below during the POST. `handleCreate` already
              // calls `close()` explicitly once it's done.
              onSelect={(e) => e.preventDefault()}
              onClick={handleCreate}
              disabled={props.mode !== "propose" && upsert.isPending}
              className="flex items-center gap-2 font-medium text-navy"
            >
              {props.mode !== "propose" && upsert.isPending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4 shrink-0 text-gold" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {props.mode === "propose"
                  ? t("cred.submit.propose", { name: term })
                  : t("cred.submit.create", { name: term })}
              </span>
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return dropdown;
}
