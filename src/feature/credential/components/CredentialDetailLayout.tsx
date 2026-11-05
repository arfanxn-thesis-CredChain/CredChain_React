import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@ui/dialog";

interface Props {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  children?: ReactNode;
  filePanel?: ReactNode;
  notices?: ReactNode;
  details?: ReactNode;
  parties?: ReactNode;
  footer?: ReactNode;
}

export function CredentialDetailLayout({
  title,
  open,
  onOpenChange,
  onCloseAutoFocus,
  children,
  filePanel,
  notices,
  details,
  parties,
  footer,
}: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl p-6 sm:max-w-5xl sm:p-8"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="mb-4 pr-10">
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-navy">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("cred.detail.cardTitle")}</DialogDescription>
        </DialogHeader>
        {children ?? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">{filePanel}</div>
            {notices}
            {details}
            <div className="space-y-6 border-t border-gray-100 pt-6">{parties}</div>
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
