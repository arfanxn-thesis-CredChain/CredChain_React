import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@shared/lib/cn";
import { notify } from "@shared/lib/notify";
import type { ReferenceResource, ReferenceRow } from "@shared/types/api";
import { useReferenceList, useUpsertReference } from "@shared/api/useReferenceData";
import { FormField } from "@ui/form-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/dialog";

interface SearchableCreateSelectBaseProps {
  resource: ReferenceResource;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
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
  const list = useReferenceList(props.resource);
  const upsert = useUpsertReference(props.resource);

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const selectedIds = multiple ? props.value : props.value ? [props.value] : [];
  const selectedNames = rows.filter((r) => selectedIds.includes(r.id)).map((r) => r.name);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const trimmed = query.trim();
  const showCreateRow = trimmed.length > 0 && filtered.length === 0 && !upsert.isPending;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const select = (row: ReferenceRow) => {
    if (multiple) {
      const next = props.value.includes(row.id)
        ? props.value.filter((id) => id !== row.id)
        : [...props.value, row.id];
      props.onChange(next);
    } else {
      props.onChange(row.id);
      close();
    }
  };

  const handleCreate = () => {
    const name = trimmed;
    if (!name) return;
    upsert.mutate(name, {
      onSuccess: (row) => {
        if (rows.some((r) => r.id === row.id)) {
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

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpen(!open)}
      disabled={props.disabled}
      className={cn(
        "flex w-full items-center rounded-xl border px-4 py-3 text-left shadow-sm transition-all",
        "bg-gray-50 text-sm",
        props.disabled && "cursor-not-allowed opacity-50",
        props.error
          ? "border-error"
          : "border-gray-200 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-gold focus:outline-none",
        props.className,
      )}
    >
      <span
        className={cn(
          "flex-1 truncate",
          selectedNames.length > 0 ? "font-medium text-navy" : "text-gray-400",
        )}
      >
        {selectedNames.length > 0
          ? selectedNames.join(", ")
          : (props.placeholder ?? t("cred.submit.searchPlaceholder"))}
      </span>
      <ChevronDown
        className={cn(
          "ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setOpen(true);
        } else {
          close();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{props.label ?? t("cred.submit.searchTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 transition-all focus-within:border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-gold">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={props.placeholder ?? t("cred.submit.searchPlaceholder")}
            className="h-11 w-full bg-transparent text-sm text-navy outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="scrollbar-hidden max-h-72 overflow-y-auto rounded-xl border border-gray-100">
          {list.isLoading && (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("cred.submit.loading")}
            </div>
          )}
          {!list.isLoading && !list.isError && filtered.length === 0 && !showCreateRow && (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              {trimmed ? t("cred.submit.noMatch") : t("cred.submit.emptyList")}
            </div>
          )}
          {!list.isLoading && list.isError && (
            <div className="px-3 py-6 text-center text-sm text-error">
              {t("cred.submit.loadError")}
            </div>
          )}
          {!list.isLoading &&
            filtered.map((row) => {
              const isSelected = selectedIds.includes(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => select(row)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-navy transition-colors hover:bg-navy/5",
                    isSelected && "bg-navy/5 font-semibold",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  {multiple && isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          {showCreateRow && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={upsert.isPending}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-3 text-left text-sm font-medium text-navy transition-colors hover:bg-gold/10"
            >
              {upsert.isPending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
              ) : (
                <Plus className="h-4 w-4 shrink-0 text-gold" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {t("cred.submit.create", { name: trimmed })}
              </span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (props.label) {
    return (
      <FormField label={props.label} error={props.error}>
        {trigger}
        {dialog}
      </FormField>
    );
  }

  return (
    <>
      {trigger}
      {dialog}
    </>
  );
}
