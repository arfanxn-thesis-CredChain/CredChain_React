import { Plus, X } from "lucide-react";
import { useFieldArray, type Control, type FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

function getNestedError(
  root: Record<string, unknown>,
  path: string,
): Record<string, unknown> | undefined {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as Record<string, unknown> | undefined;
}

interface MetaEditorProps<T extends FieldValues> {
  control: Control<T>;
  name?: string;
}

export function MetaEditor<T extends FieldValues>({
  control,
  name = "meta_entries",
}: MetaEditorProps<T>) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as never,
  });

  const errors = getNestedError(control._formState.errors as Record<string, unknown>, name) as
    | { [k: number]: { key?: { message?: string }; value?: { message?: string } } }
    | undefined;

  return (
    <div className="space-y-3">
      {/* No self-label: every call site already labels this section. */}
      <div className="space-y-2">
        {fields.length === 0 && <p className="text-xs text-gray-400 italic">{t("meta.empty")}</p>}
        {fields.map((field, idx) => {
          const keyError = errors?.[idx]?.key?.message;
          const valueError = errors?.[idx]?.value?.message;
          return (
            <div key={field.id} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Input
                    placeholder={t("meta.keyPlaceholder")}
                    aria-label={t("meta.keyAriaLabel", { n: idx + 1 })}
                    {...control.register(`${name}.${idx}.key` as never)}
                  />
                  {keyError && (
                    <p className="mt-1 text-xs text-error" role="alert">
                      {t(keyError)}
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    placeholder={t("meta.valuePlaceholder")}
                    aria-label={t("meta.valueAriaLabel", { n: idx + 1 })}
                    {...control.register(`${name}.${idx}.value` as never)}
                  />
                  {valueError && (
                    <p className="mt-1 text-xs text-error" role="alert">
                      {t(valueError)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(idx)}
                aria-label={t("meta.removeAriaLabel", { n: idx + 1 })}
                className="mt-0.5 h-10 w-10 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ key: "", value: "" } as never)}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("meta.addField")}
        </Button>
      </div>
    </div>
  );
}
