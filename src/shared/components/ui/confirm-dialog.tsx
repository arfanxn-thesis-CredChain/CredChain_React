import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { Button, type ButtonProps } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonProps["variant"];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogPrimitive.Close asChild>
            <Button variant="outline" disabled={loading}>
              {cancelLabel}
            </Button>
          </DialogPrimitive.Close>
          <Button autoFocus variant={tone} onClick={() => void onConfirm()} disabled={loading}>
            {loading ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmOptions = Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel" | "loading">;

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((confirmed: boolean) => void) | null;
}

export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    options: null,
    resolve: null,
  });
  const [loading, setLoading] = React.useState(false);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ open: true, options, resolve });
      }),
    [],
  );

  const handleCancel = () => {
    state.resolve?.(false);
    setState({ open: false, options: null, resolve: null });
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      state.resolve?.(true);
      setState({ open: false, options: null, resolve: null });
    } finally {
      setLoading(false);
    }
  };

  const dialog = state.options ? (
    <ConfirmDialog
      open={state.open}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      loading={loading}
      {...state.options}
    />
  ) : null;

  return { confirm, dialog };
}
