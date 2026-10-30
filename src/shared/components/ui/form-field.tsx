import { useTranslation } from "react-i18next";
import { cn } from "@shared/lib/cn";
import { Label } from "@ui/label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  errorId?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  errorId,
  hint,
  error,
  optional,
  children,
}: FormFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-gray-400">{t("common.optional")}</span>}
      </Label>
      {children}
      {error ? (
        <p id={errorId} className={cn("mt-1 text-xs text-error")} role="alert">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}
