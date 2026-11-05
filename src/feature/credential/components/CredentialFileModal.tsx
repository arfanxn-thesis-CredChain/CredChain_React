import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@ui/dialog";
import { Button } from "@ui/button";

interface CredentialFileModalProps {
  file: File | Blob;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** Display name for the file (Blob has no .name). Falls back to "Credential File". */
  name?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CredentialFileModal({
  file,
  open,
  onClose,
  name,
  onCloseAutoFocus,
}: CredentialFileModalProps) {
  const { t } = useTranslation();
  const isPdf = file.type === "application/pdf";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-5xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {name || (file instanceof File ? file.name : "Credential File")}
          </DialogTitle>
          <DialogDescription>
            {formatFileSize(file.size)}
            {" · "}
            {file.type || t("credential.issue.preview.notAvailable")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[40vh] items-center justify-center overflow-auto rounded-xl bg-gray-100">
          {isPdf ? (
            <PdfViewer file={file} key={file.size + (file instanceof File ? file.name : "")} />
          ) : (
            <ImageViewer file={file} key={file.size + (file instanceof File ? file.name : "")} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageViewer({ file }: { file: File | Blob }) {
  const { t } = useTranslation();
  const objectUrlRef = useRef<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      {objectUrl ? (
        <img
          src={objectUrl}
          alt={file instanceof File ? file.name : ""}
          className="max-h-[60vh] max-w-full object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-sm text-gray-400">{t("credential.issue.preview.notAvailable")}</span>
      )}
    </div>
  );
}

interface PdfPageProxy {
  getViewport: (o: { scale: number }) => { height: number; width: number };
  render: (o: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { height: number; width: number };
  }) => { promise: Promise<void> };
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
  destroy: () => void;
}

function PdfViewer({ file }: { file: File | Blob }) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<PdfDocumentProxy | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = (await pdfjsLib.getDocument(objectUrl).promise) as unknown as PdfDocumentProxy;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setPageNum(1);
        setError(null);
      } catch {
        if (!cancelled) {
          setError(tRef.current("credential.issue.preview.corrupt"));
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    if (!doc || !canvasRef.current) return;
    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        if (!cancelled) setError(tRef.current("credential.issue.preview.corrupt"));
      }
    };

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pageNum, totalPages]);

  if (error) {
    return <span className="text-sm text-gray-400">{error}</span>;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} className="max-h-[60vh] max-w-full rounded-lg shadow-lg" />
      {totalPages > 1 && (
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pageNum <= 1}
            aria-label={t("credential.issue.preview.previousPage")}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500">
            {t("credential.issue.preview.pageCount", { current: pageNum, total: totalPages })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pageNum >= totalPages}
            aria-label={t("credential.issue.preview.nextPage")}
            onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
