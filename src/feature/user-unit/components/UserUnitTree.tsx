import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { isApiError } from "@shared/api/envelope";
import { EmptyState } from "@shared/components/EmptyState";
import { InlineCreateRow } from "@shared/components/InlineCreateRow";
import { RoleGate } from "@shared/auth/guards";
import { Role } from "@shared/auth/role";
import { cn } from "@shared/lib/cn";
import type { HolderUnitDTO } from "@shared/types/api";
import { Button } from "@ui/button";
import { useConfirm } from "@ui/confirm-dialog";
import { Input } from "@ui/input";
import { Skeleton } from "@ui/skeleton";
import {
  useDestroyUserUnit,
  useStoreUserUnit,
  useUpdateUserUnit,
} from "../api/useMutateUserUnits";
import { ROOT_DROP_ID, resolveMove } from "../lib/resolveMove";

interface UserUnitTreeProps {
  units: HolderUnitDTO[];
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** True while a search term is applied — every returned node is a match or an ancestor of one. */
  searchActive?: boolean;
}

interface TreeNode {
  unit: HolderUnitDTO;
  children: TreeNode[];
  depth: number;
}

const ADMIN_ROLES = [Role.ADMIN, Role.SUPER_ADMIN];

/** Grip drag handle: drag (mouse or touch) to reparent a unit. */
function DragHandle({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn("cursor-grab touch-none", isDragging && "cursor-grabbing opacity-40")}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  );
}

/** A tree row that is a drop target; highlights gold for a valid drop, red for invalid. */
function DroppableRow({
  id,
  style,
  className,
  activeId,
  isInvalidTarget,
  children,
}: {
  id: string;
  style?: CSSProperties;
  className?: string;
  activeId: string | null;
  isInvalidTarget: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const highlight = isOver && activeId !== null && activeId !== id;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        className,
        highlight && !isInvalidTarget && "bg-gold/10 ring-2 ring-inset ring-gold/60",
        highlight && isInvalidTarget && "cursor-no-drop bg-error/5 ring-2 ring-inset ring-error/40",
      )}
    >
      {children}
    </div>
  );
}

/** Drop zone shown while dragging a nested unit — dropping here promotes it to a root unit. */
function RootDropZone({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-3 rounded-xl border-2 border-dashed px-4 py-3 text-center text-sm transition-colors",
        isOver ? "border-gold bg-gold/10 font-medium text-navy" : "border-gray-200 text-gray-400",
      )}
    >
      {label}
    </div>
  );
}

export function UserUnitTree({
  units,
  isLoading = false,
  searchValue,
  onSearchChange,
  searchActive = false,
}: UserUnitTreeProps) {
  const { t } = useTranslation();
  const store = useStoreUserUnit();
  const update = useUpdateUserUnit();
  const destroy = useDestroyUserUnit();
  const { confirm, dialog } = useConfirm();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingParentId, setCreatingParentId] = useState<string | null | undefined>(undefined);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // Mouse: start after an 8px drag so a plain click still opens the dialog.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: press-and-hold to drag so a swipe scrolls the page instead of dragging.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

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
        // Search results are already pruned to matches + ancestors server-side,
        // so every returned node belongs on screen regardless of expand state.
        // `expanded` is never mutated here, so clearing the query restores the
        // user's own expand state exactly.
        if (searchActive || expanded.has(node.unit.id)) walk(node.children);
      }
    };
    walk(roots);
    return out;
  }, [roots, expanded, searchActive]);

  // Drop targets that are illegal or no-ops for the current drag (self, current
  // parent, own descendants) — used purely to tint the drop highlight red.
  const invalidTargets = useMemo(() => {
    const set = new Set<string>();
    if (!activeId) return set;
    const active = units.find((u) => u.id === activeId);
    if (!active) return set;
    set.add(activeId);
    if (active.parent_id) set.add(active.parent_id);
    const walk = (id: string) => {
      for (const child of childrenMap.get(id) ?? []) {
        set.add(child.id);
        walk(child.id);
      }
    };
    walk(activeId);
    return set;
  }, [activeId, units, childrenMap]);

  const activeUnit = activeId ? (units.find((u) => u.id === activeId) ?? null) : null;

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

  const submitCreate = (parentId: string | null, name: string) => {
    store.mutate(
      { name, parent_id: parentId },
      {
        onSuccess: () => {
          if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
          setCreatingParentId(undefined);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedId = String(event.active.id);
    setActiveId(null);
    const overId = event.over ? String(event.over.id) : null;
    const result = resolveMove(draggedId, overId, units);
    if (!result) return;
    update.mutate(
      { id: draggedId, parent_id: result.parentId },
      {
        onSuccess: () => {
          if (result.parentId) {
            setExpanded((prev) => new Set(prev).add(result.parentId as string));
          }
          clearRowError(draggedId);
        },
        onError: (error) => {
          setRowError(draggedId, isApiError(error) ? error.messageKey : "admin.userUnit.actionError");
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

  // One shared row for both call sites. `key` forces a fresh field per open so
  // a name typed under one parent never leaks into the next.
  const createForm = (parentId: string | null, triggerLabel?: string) => (
    <InlineCreateRow
      key={`create-${parentId ?? "root"}`}
      open={creatingParentId === parentId}
      onOpenChange={(next) => {
        if (next) {
          setCreateError(null);
          setCreatingParentId(parentId);
        } else {
          setCreatingParentId(undefined);
        }
      }}
      onSubmit={(name) => submitCreate(parentId, name)}
      triggerLabel={triggerLabel}
      placeholder={t("userUnit.createPlaceholder")}
      submitLabel={t("userUnit.createSubmit")}
      isPending={store.isPending}
    />
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
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Search sits outside the gate: it is a read affordance every role needs. */}
        <div className="space-y-4 p-4 sm:p-6">
          {onSearchChange && (
            <div className="w-full md:max-w-2xl">
              <Input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                leadingIcon={Search}
                placeholder={t("userUnit.searchPlaceholder")}
                aria-label={t("userUnit.searchPlaceholder")}
                value={searchValue ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          )}
          <RoleGate allowed={ADMIN_ROLES}>
            {createForm(null, t("userUnit.addRoot"))}
            {activeUnit && activeUnit.parent_id !== null && (
              <RootDropZone label={t("userUnit.rootDropZone")} />
            )}
          </RoleGate>
        </div>

        {units.length === 0 ? (
          <EmptyState
            icon={searchActive ? SearchX : FolderTree}
            title={searchActive ? t("userUnit.empty.search.title") : t("userUnit.empty.title")}
            description={
              searchActive ? t("userUnit.empty.search.body") : t("userUnit.empty.description")
            }
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
                  <DroppableRow
                    id={node.unit.id}
                    activeId={activeId}
                    isInvalidTarget={invalidTargets.has(node.unit.id)}
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
                          {/* flex-1 on the wrapper: Input forwards className to
                              the inner <input>, not to this flex child. */}
                          <div className="min-w-0 flex-1">
                            <Input
                              size="compact"
                              value={renameName}
                              onChange={(event) => setRenameName(event.target.value)}
                              autoFocus
                              aria-label={t("userUnit.renamePlaceholder")}
                            />
                          </div>
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

                    {renamingId !== node.unit.id && (
                    <RoleGate allowed={ADMIN_ROLES}>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("userUnit.addSubunit", { name: node.unit.name })}
                          onClick={() => {
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
                        <DragHandle
                          id={node.unit.id}
                          label={t("userUnit.move", { name: node.unit.name })}
                        />
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
                    )}
                  </DroppableRow>

                  {creatingParentId === node.unit.id && (
                    <div
                      className="pb-3"
                      style={{ paddingLeft: `${(node.depth + 1) * 24 + 16}px`, paddingRight: "1rem" }}
                    >
                      {createForm(node.unit.id)}
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

        <DragOverlay dropAnimation={null}>
          {activeUnit ? (
            <div className="inline-flex w-max max-w-xs items-center gap-2 rounded-xl border border-gold/50 bg-surface px-3 py-2 text-sm font-medium text-navy shadow-lg shadow-navy/20">
              <GripVertical className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="truncate">{activeUnit.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {dialog}
    </div>
  );
}
