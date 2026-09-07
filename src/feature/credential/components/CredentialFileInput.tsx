import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileDropzone } from "@ui/file-dropzone";
import { CredentialFilePreview } from "./CredentialFilePreview";

interface CredentialFileInputProps {
  file: File | null;
  onChange: (file: File | null) => void;
  onExpand?: () => void;
  error?: string;
}

export function CredentialFileInput({ file, onChange, onExpand, error }: CredentialFileInputProps) {
  const { t } = useTranslation();
  const noop = useCallback(() => {}, []);

  const handleRemove = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handleFileDrop = useCallback(
    (f: File) => {
      onChange(f);
    },
    [onChange],
  );

  if (!file) {
    return (
      <FileDropzone
        file={null}
        onChange={onChange}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff"
        emptyLabel={t("credential.issue.preview.dragDrop")}
        hint={t("cred.field.fileHint")}
        error={error ? t(error) : undefined}
      />
    );
  }

  return (
    <div>
      <CredentialFilePreview
        file={file}
        onExpand={onExpand ?? noop}
        onRemove={handleRemove}
        onFileDrop={handleFileDrop}
      />
      {error && (
        <p className="mt-1.5 text-xs text-error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}
