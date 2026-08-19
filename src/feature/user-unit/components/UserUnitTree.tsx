import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { isApiError } from "@shared/api/envelope";
import { EmptyState } from "@shared/components/EmptyState";
import { RoleGate } from "@shared/auth/guards";
import { Role } from "@shared/auth/role";
import { cn } from "@shared/lib/cn";
import type { HolderUnitDTO } from "@shared/types/api";
import { Button } from "@ui/button";
import { useConfirm } from "@ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@ui/dialog";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import {
  useDestroyUserUnit,
  useStoreUserUnit,
  useUpdateUserUnit,
} from "../api/useMutateUserUnits";

interface UserUnitTreeProps {
  units: HolderUnitDTO[];
  isLoading?: boolean;
}

interface TreeNode {
  unit: HolderUnitDTO;
  children: TreeNode[];
  depth: number;
}

const ADMIN_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];

export function UserUnitTree({ units, isLoading = false }: UserUnitTreeProps) {
  const { t } = useTranslation();
  const store = useStoreUserUnit();
  const update = useUpdateUserUnit();
  const destroy = useDestroyUserUnit();
  const { confirm, dialog } = useConfirm();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [moving, setMoving] = useState<HolderUnitDTO | null>(null);
  const [moveQuery, setMoveQuery] = useState("");
  const [moveParentId, setMoveParentId] = useState<string | undefined>(undefined);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, HolderUnitDTO[]>();
    const byId = new Map(units.map((u) => [u.id, u]));
    for (const u of units) {
      const pid = u.parent_id && byId.has(u.parent_id) ? u.parent_id : null;
      const arr = map.get(pid) ?? [];
      arr.push(u);
      map.set(pid, arr);
    }
    return map;
  }, [units]);

  const roots = useMemo(() => {
    const build = (unit: HolderUnitDTO, depth: number): TreeNode => {
      const children = (childrenMap.get(unit.id) ?? [])
        .map((child) => build(child, depth + 1))
        .sort((a, b) => a.unit.name.localeCompare(b.unit.name));
      return { unit, children, depth };
    };
    return (childrenMap.get(null) ?? [])
      .map((root) => build(root, 0))
      .sort((a, b) => a.unit.name.localeCompare(b.unit.name));
  }, [childrenMap]);

  const pathOf = useMemo(() => {
    const map = new Map<string, string[]>();
    const walk = (pid: string | null, path: string[]) => {
      const kids = childrenMap.get(pid) ?? [];
      for (const kid of kids) {
        const next = [...path, kid.name];
        map.set(kid.id, next);
        walk(kid.id, next);
      }
    };
    walk(null, []);
    return map;
  }, [childrenMap]);

  const visibleRows = useMemo(() => {
    const out: TreeNode[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        out.push(node);
        if (expanded.has(node.unit.id)) walk(node.children);
      }
    };
    walk(roots);
    return out;
  }, [roots, expanded]);

  const moveOptions = useMemo(() => {
    if (!moving) return [];
    const excluded = new Set([moving.id]);
    const walkDescendants = (id: string) => {
      for (const child of childrenMap.get(id) ?? []) {
        excluded.add(child.id);
        walkDescendants(child.id);
      }
    };
    walkDescendants(moving.id);
    const q = moveQuery.trim().toLowerCase();
    return units.filter((u) => {
      if (excluded.has(u.id)) return false;
      if (!q) return true;
      const label = pathOf.get(u.id)?.join(" › ").toLowerCase() ?? "";
      return label.includes(q);
    });
  }, [moving, units, childrenMap, pathOf, moveQuery]);

  const setRowError = (id: string, key: string) => {
    setRowErrors((prev) => ({ ...prev, [id]: key }));
  };
  const clearRowError = (id: string) => {
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const openRootCreate = () => {
    setCreateName("");
    setCreateError(null);
    setCreatingParentId(null);
  };

  const submitCreate = (parentId: string | null) => {
    const name = createName.trim();
    if (!name) {
      setCreateError("zod.name.required");
      return;
    }
    store.mutate(
      { name, parent_id: parentId },
      {
        onSuccess: () => {
          if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
          setCreatingParentId(undefined);
          setCreateName("");
          setCreateError(null);
        },
        onError: (error) => {
          setCreateError(isApiError(error) ? error.messageKey : "admin.userUnit.actionError");
        },
      },
    );
  };

  const submitRename = (unit: HolderUnitDTO) => {
    const name = renameName.trim();
    if (!name) {
      setRowError(unit.id, "zod.name.required");
      return;
    }
    update.mutate(
      { id: unit.id, name },
      {
        onSuccess: () => {
          setRenamingId(null);
          setRenameName("");
          clearRowError(unit.id);
        },
        onError: (error) => {
          setRowError(unit.id, isApiError(error) ? error.messageKey : "admin.userUnit.actionError");
        },
      },
    );
  };

  const submitMove = () => {
    if (!moving || moveParentId === undefined) return;
    update.mutate(
      { id: moving.id, parent_id: moveParentId },
      {
        onSuccess: () => {
          setMoving(null);
          setMoveQuery("");
          setMoveParentId(undefined);
          clearRowError(moving.id);
        },
        onError: (error) => {
          setRowError(moving.id, isApiError(error) ? error.messageKey : "admin.userUnit.actionError");
          setMoving(null);
          setMoveQuery("");
        },
      },
    );
  };

  const handleDestroy = async (unit: HolderUnitDTO) => {
    const ok = await confirm({
      title: t("userUnit.destroy.title", { name: unit.name }),
      description: t("userUnit.destroy.description"),
      confirmLabel: t("userUnit.destroy.confirm"),
      cancelLabel: t("common.cancel"),
      tone: "destructive",
    });
    if (ok) {
      destroy.mutate(unit.id, {
        onError: (error) => {
          setRowError(unit.id, isApiError(error) ? error.messageKey : "admin.userUnit.actionError");
        },
      });
    }
  };

  const createForm = (indent: string) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitCreate(creatingParentId ?? null);
      }}
      className={cn("flex items-center gap-2", indent)}
    >
      <Input
        value={createName}
        onChange={(event) => setCreateName(event.target.value)}
        placeholder={t("userUnit.createPlaceholder")}
        autoFocus
        className="h-9 py-2"
        aria-label={t("userUnit.createPlaceholder")}
      />
      <Button type="submit" size="sm" disabled={store.isPending} className="shrink-0">
        {store.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        {t("userUnit.createSubmit")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => setCreatingParentId(undefined)}
      >
        {t("common.cancel")}
      </Button>
    </form>
  );

  if (isLoading) {
    return (
      <div className="space-y-0 divide-y divide-gray-50">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`sk-${i}`} className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 sm:p-6">
        <RoleGate allowed={ADMIN_ROLES}>
          {creatingParentId === null ? (
            createForm("flex flex-col items-stretch gap-2 sm:flex-row sm:items-center")
          ) : (
            <Button variant="dashed" size="sm" onClick={openRootCreate}>
              <Plus className="h-4 w-4" />
              {t("userUnit.addRoot")}
            </Button>
          )}
        </RoleGate>
      </div>

      {units.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t("userUnit.empty.title")}
          description={t("userUnit.empty.description")}
          className="rounded-none border-0 shadow-none"
        />
      ) : (
        <div className="divide-y divide-gray-50">
          {visibleRows.map((node) => {
            const path = pathOf.get(node.unit.id) ?? [];
            const isExpanded = expanded.has(node.unit.id);
            const rowError = rowErrors[node.unit.id];
            return (
              <Fragment key={node.unit.id}>
                <div
                  className="flex items-start gap-2 px-4 py-3 sm:px-6"
                  style={{ paddingLeft: `${node.depth * 24 + 16}px` }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(node.unit.id)) next.delete(node.unit.id);
                        else next.add(node.unit.id);
                        return next;
                      });
                    }}
                    disabled={node.children.length === 0}
                    aria-label={
                      isExpanded ? t("userUnit.collapse", { name: node.unit.name }) : t("userUnit.expand", { name: node.unit.name })
                    }
                    aria-expanded={node.children.length > 0 ? isExpanded : undefined}
                    className={cn(
                      "mt-0.5 shrink-0 rounded p-0.5 text-gray-400 transition-colors",
                      "hover:text-navy focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                      node.children.length === 0 && "invisible",
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    {renamingId === node.unit.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitRename(node.unit);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          value={renameName}
                          onChange={(event) => setRenameName(event.target.value)}
                          autoFocus
                          className="h-9 py-2"
                          aria-label={t("userUnit.renamePlaceholder")}
                        />
                        <Button type="submit" size="sm" disabled={update.isPending} className="shrink-0">
                          {update.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : null}
                          {t("userUnit.renameSubmit")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setRenamingId(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </form>
                    ) : (
                      <span className="text-sm font-medium text-navy">{node.unit.name}</span>
                    )}
                    {path.length > 0 && (
                      <p aria-label={t("userUnit.path")} className="mt-0.5 truncate text-xs text-gray-400">
                        {path.join(" › ")}
                      </p>
                    )}
                    {rowError && (
                      <p role="alert" className="mt-1 text-xs text-error">
                        {t(rowError)}
                      </p>
                    )}
                  </div>

                  <RoleGate allowed={ADMIN_ROLES}>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("userUnit.addSubunit", { name: node.unit.name })}
                        onClick={() => {
                          setCreateName("");
                          setCreateError(null);
                          setCreatingParentId(node.unit.id);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("userUnit.rename", { name: node.unit.name })}
                        onClick={() => {
                          setRenamingId(node.unit.id);
                          setRenameName(node.unit.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("userUnit.move", { name: node.unit.name })}
                        onClick={() => {
                          setMoving(node.unit);
                          setMoveQuery("");
                          setMoveParentId(node.unit.parent_id ?? undefined);
                        }}
                      >
                        <FolderTree className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("userUnit.destroy.menu", { name: node.unit.name })}
                        onClick={() => void handleDestroy(node.unit)}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </Button>
                    </div>
                  </RoleGate>
                </div>

                {creatingParentId === node.unit.id && (
                  <div
                    className="pb-3"
                    style={{ paddingLeft: `${(node.depth + 1) * 24 + 16}px`, paddingRight: "1rem" }}
                  >
                    {createForm("flex flex-col items-stretch gap-2 sm:flex-row sm:items-center")}
                    {createError && (
                      <p role="alert" className="mt-1 text-xs text-error">
                        {t(createError)}
                      </p>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      <Dialog
        open={moving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMoving(null);
            setMoveQuery("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("userUnit.moveTitle")}</DialogTitle>
            {moving && (
              <DialogDescription>{t("userUnit.moveDescription", { name: moving.name })}</DialogDescription>
            )}
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 transition-all focus-within:border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-gold">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={moveQuery}
              onChange={(event) => setMoveQuery(event.target.value)}
              placeholder={t("userUnit.movePlaceholder")}
              className="h-11 w-full bg-transparent text-sm text-navy outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="scrollbar-hidden max-h-72 overflow-y-auto rounded-xl border border-gray-100">
            {moveOptions.map((option) => {
              const label = pathOf.get(option.id)?.join(" › ") ?? option.name;
              const isSelected = moveParentId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMoveParentId(option.id)}
                  className={cn(
                    "flex w-full items-center px-3 py-2.5 text-left text-sm text-navy transition-colors hover:bg-navy/5",
                    isSelected && "bg-navy/5 font-semibold",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              );
            })}
            {moveOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                {t("userUnit.moveNoMatch")}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoving(null)}
              disabled={update.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={submitMove}
              disabled={update.isPending || moveParentId === undefined}
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t("userUnit.moveSubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
