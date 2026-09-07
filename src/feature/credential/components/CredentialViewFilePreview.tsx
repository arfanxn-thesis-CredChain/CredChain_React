import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { File, Eye, Download } from "lucide-react";
import { Button } from "@ui/button";
import { Skeleton } from "@ui/skeleton";
import { useCredentialFile } from "../api/useCredentialFile";
import { toKebabCase } from "@shared/lib/format";
import { CredentialFileModal } from "./CredentialFileModal";

interface CredentialViewFilePreviewProps {
  credentialId: string;
  credentialName: string;
  hasFileUri: boolean;
  statusSlot?: React.ReactNode;
}

const ALLOWED_IMAGE_MIME_PREFIXES = ["image/jpeg", "image/png", "image/webp"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(mimeType: string): string {
  const parts = mimeType.split("/");
  if (parts.length === 2) {
    if (parts[1] === "jpeg") return ".jpg";
    return `.${parts[1]}`;
  }
  return "";
}

export function CredentialViewFilePreview({
  credentialId,
  credentialName,
  hasFileUri,
  statusSlot,
}: CredentialViewFilePreviewProps) {
  const { t } = useTranslation();
  const { data: blob, isLoading } = useCredentialFile(credentialId, hasFileUri);
  const [modalOpen, setModalOpen] = useState(false);

  if (!hasFileUri) return null;

  const mimeType = blob?.type ?? "";
  const isPdf = mimeType === "application/pdf";
  const isImage = ALLOWED_IMAGE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
  const size = blob?.size ?? 0;
  const ext = getFileExtension(mimeType);
  const downloadName = `${toKebabCase(credentialName)}${ext}`;

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="h-[92px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : blob ? (
            <BlobThumbnail blob={blob} isPdf={isPdf} isImage={isImage} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <File className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-48" />
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-navy">{downloadName}</p>
              {size > 0 && <p className="text-xs text-gray-400">{formatFileSize(size)}</p>}
              {statusSlot && <div className="mt-2">{statusSlot}</div>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  disabled={!blob}
                >
                  <Eye className="h-4 w-4" />
                  {t("cred.detail.view")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!blob}
                >
                  <Download className="h-4 w-4" />
                  {t("cred.detail.download")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {blob && (
        <CredentialFileModal
          file={blob}
          name={downloadName}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function PdfBlobThumbnail({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const objectUrl = URL.createObjectURL(blob);

    const render = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = await pdfjsLib.getDocument(objectUrl).promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.15 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          pdf.destroy();
          return;
        }

        const ctx = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        pdf.destroy();
      } catch {
        if (!cancelled) setError(true);
      }
    };

    render();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <File className="h-5 w-5 text-gray-400" />
      </div>
    );
  }

  return <canvas ref={canvasRef} className="h-full w-full object-cover" />;
}

function BlobThumbnail({ blob, isPdf, isImage }: { blob: Blob; isPdf: boolean; isImage: boolean }) {
  const objectUrlRef = useRef<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isPdf || !isImage) return;
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);
    setError(false);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [blob, isImage, isPdf]);

  if (isPdf) return <PdfBlobThumbnail blob={blob} />;
  if (!isImage) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <File className="h-5 w-5 text-gray-400" />
      </div>
    );
  }
  if (error || !objectUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <File className="h-5 w-5 text-gray-400" />
      </div>
    );
  }
  return (
    <img
      src={objectUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setError(true)}
    />
  );
}
