import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@ui/dialog";
import { FileDropzone } from "@ui/file-dropzone";
import { Input } from "@ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import { useUserUnits } from "@shared/api/useUserUnits";
import { createUnitResolver, flattenUnitTree } from "@shared/lib/units";
import { formatISODate } from "@shared/lib/format";
import type { HolderUnitDTO } from "@shared/types/api";
import { type UserStoreFormInput, userStoreFormSchema } from "../schemas/user";
import type { UserKind } from "../UserCreate";

export const FIXED_COLUMNS = [
  "fullname",
  "email",
  "unit",
  "joined_year",
  "number",
  "birth_date",
  "gender",
  "role",
] as const;

const REQUIRED_COLUMNS: readonly string[] = ["fullname", "email", "role"];

export const COLUMN_TO_FIELD: Record<string, string> = {
  fullname: "name",
  email: "email",
  unit: "unit_id",
  joined_year: "joined_year",
  number: "number",
  birth_date: "birth_date",
  gender: "gender",
  role: "role",
};

/**
 * Headers from templates downloaded before the rename.
 *
 * Neither old name is in REQUIRED_COLUMNS, so without this map they do not
 * error — they fall through into meta_entries, which is a silent wrong import.
 */
const LEGACY_HEADERS: Record<string, string> = { unit_id: "unit", number_id: "number" };

export const normHeader = (header: string): string => {
  const key = header.trim().toLowerCase();
  return LEGACY_HEADERS[key] ?? key;
};

const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

interface UserImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: UserStoreFormInput[]) => void;
  kind?: UserKind;
}

interface ParsedRow {
  // Date because XLSX.read runs with cellDates, so date cells arrive typed.
  [key: string]: string | number | boolean | Date | null;
}

interface ValidationError {
  row: number;
  field: string;
  error: string;
}

/**
 * Example unit cells drawn from real units, because the `unit` column is now
 * resolved: an invented name would make the template fail its own first import.
 */
function exampleUnits(units: HolderUnitDTO[]): [string, string] {
  const nodes = flattenUnitTree(units);
  return [nodes[0]?.name ?? "Fakultas Teknik", nodes[1]?.name ?? "Fakultas Teknik > Teknik Informatika"];
}

/**
 * Example rows for the downloadable template, branched on kind so the file
 * the app hands out never fails the app's own import: a Student-mode
 * template with an "issuer" example row is a self-contradiction, same class
 * of bug as an invented unit name (see exampleUnits above).
 */
export function templateRows(units: HolderUnitDTO[], kind: UserKind): string[][] {
  const [unitA, unitB] = exampleUnits(units);
  if (kind === "student") {
    return [
      ["Alice Johnson", "alice@example.com", unitA, "2024", "22100001", "1995-03-15", "female", "holder"],
      ["Bob Smith", "bob@example.com", unitB, "2023", "22100002", "1990-07-22", "male", "holder"],
    ];
  }
  return [
    ["Alice Johnson", "alice@example.com", unitA, "2024", "EMP-001", "1995-03-15", "female", "issuer"],
    ["Bob Smith", "bob@example.com", unitB, "2023", "EMP-002", "1990-07-22", "male", "issuer"],
  ];
}

function downloadTemplate(units: HolderUnitDTO[], kind: UserKind) {
  const headers = [...FIXED_COLUMNS];
  const headerRow = headers.map((h) => ({ t: "s", v: h }) satisfies XLSX.CellObject);
  const exampleRows: XLSX.CellObject[][] = templateRows(units, kind).map((row) =>
    row.map((v) => ({ t: "s", v }) satisfies XLSX.CellObject),
  );

  const aoa: XLSX.CellObject[][] = [headerRow, ...exampleRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  XLSX.writeFile(wb, `credchain-users-template-${kind}.xlsx`, { bookType: "xlsx" });
}

export function UserImportModal({ open, onClose, onImport, kind }: UserImportModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [fromRow, setFromRow] = useState(1);
  const [toRow, setToRow] = useState(100);
  const [rangeError, setRangeError] = useState<string | undefined>();
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [metaColumnCount, setMetaColumnCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validatedRows, setValidatedRows] = useState<UserStoreFormInput[]>([]);

  const { data: units } = useUserUnits();
  // Maps built once per unit list, not once per row.
  const resolveUnit = useMemo(() => createUnitResolver(units ?? []), [units]);

  const validateRange = useCallback(
    (from: number, to: number, total: number): string | undefined => {
      if (from < 1 || from > total) return "userImport.invalidRange";
      if (to < from || to > total) return "userImport.invalidRange";
      if (to - from + 1 > 100) return "userImport.invalidRange";
      return undefined;
    },
    [],
  );

  const buildRowsFromParsed = useCallback(
    (data: ParsedRow[], from: number, to: number) => {
    const slice = data.slice(from - 1, to);
    if (slice.length === 0)
      return {
        rows: [] as UserStoreFormInput[],
        missing: [] as string[],
        metaCount: 0,
        errors: [] as ValidationError[],
      };

    const headers = Object.keys(slice[0]);
    const normalizedHeaders = headers.map(normHeader);

    const missing = REQUIRED_COLUMNS.filter((col) => !normalizedHeaders.includes(col));

    const fixedSet = new Set(FIXED_COLUMNS);
    const metaKeys = headers.filter(
      (h) => !fixedSet.has(normHeader(h) as (typeof FIXED_COLUMNS)[number]),
    );
    const metaCount = metaKeys.length;
    const errors: ValidationError[] = [];

    const rows: UserStoreFormInput[] = slice.map((row, idx) => {
      const rowNumber = from + idx;
      const mapped: UserStoreFormInput = {
        name: "",
        number: undefined,
        unit_id: undefined,
        joined_year: undefined,
        email: "",
        birth_date: undefined,
        gender: undefined,
        meta_entries: [],
        role: kind === "employee" ? "issuer" : "holder",
      };

      for (const header of headers) {
        const key = normHeader(header);
        const field = COLUMN_TO_FIELD[key];
        if (!field) continue;

        const raw = row[header];
        if (raw === null || raw === undefined) continue;
        const val = raw instanceof Date ? formatISODate(raw) : String(raw).trim();
        if (val === "") continue;

        if (field === "gender") {
          const lower = val.toLowerCase();
          if (lower === "male" || lower === "female") {
            mapped.gender = lower;
          } else {
            // Fail loud: silently dropping the cell imports the wrong record.
            errors.push({
              row: rowNumber,
              field: "gender",
              error: t("userImport.validation.genderInvalid", { value: val }),
            });
          }
        } else if (field === "role") {
          const lower = val.toLowerCase();
          if (lower === "holder" || lower === "issuer" || lower === "admin") {
            if (kind === "student" && lower !== "holder") {
              // Students are always Holder; a non-holder cell is a real
              // conflict, not something to silently overwrite.
              errors.push({
                row: rowNumber,
                field: "role",
                error: t("userImport.validation.roleNotHolder", { value: val }),
              });
            } else if (kind === "employee" && lower === "holder") {
              // Employees and students are separate flows now; a Holder cell
              // in an employee import is a real conflict, not something to
              // silently overwrite.
              errors.push({
                row: rowNumber,
                field: "role",
                error: t("userImport.validation.roleHolderNotEmployee", { value: val }),
              });
            } else {
              mapped.role = lower;
            }
          } else {
            // The holder default stands only for an absent column, never a typo.
            errors.push({
              row: rowNumber,
              field: "role",
              error: t("userImport.validation.roleInvalid", { value: val }),
            });
          }
        } else if (field === "unit_id") {
          const ref = resolveUnit(val);
          if (ref.ok) {
            mapped.unit_id = ref.id;
          } else if (ref.reason === "ambiguous") {
            errors.push({
              row: rowNumber,
              field: "unit",
              error: t("userImport.validation.unitAmbiguous", {
                value: val,
                candidates: ref.candidates.join("; "),
              }),
            });
          } else if (ref.reason === "inactive") {
            errors.push({
              row: rowNumber,
              field: "unit",
              error: t("userImport.validation.unitInactive", { value: val, path: ref.path }),
            });
          } else {
            errors.push({
              row: rowNumber,
              field: "unit",
              error: t("userImport.validation.unitUnknown", { value: val }),
            });
          }
        } else if (field === "joined_year") {
          const year = Number(val);
          if (Number.isInteger(year)) {
            mapped.joined_year = year;
          }
        } else if (field === "name") {
          mapped.name = val;
        } else if (field === "email") {
          mapped.email = val;
        } else if (field === "number") {
          mapped.number = val;
        } else if (field === "birth_date") {
          mapped.birth_date = val;
        }
      }

      mapped.meta_entries = metaKeys
        .map((mk) => {
          const raw = row[mk];
          if (raw === null || raw === undefined) return null;
          const v = String(raw).trim();
          if (v === "") return null;
          return { key: mk.trim(), value: v };
        })
        .filter((e): e is { key: string; value: string } => e !== null);

      return mapped;
    });

    return { rows, missing, metaCount, errors };
    },
    [t, resolveUnit, kind],
  );

  const validateRows = useCallback(
    (
      rows: UserStoreFormInput[],
      from: number,
    ): { errors: ValidationError[]; valid: UserStoreFormInput[] } => {
      const errors: ValidationError[] = [];
      const valid: UserStoreFormInput[] = [];

      rows.forEach((row, idx) => {
        const result = userStoreFormSchema.safeParse(row);
        if (result.success) {
          valid.push(result.data);
        } else {
          for (const issue of result.error.issues) {
            const field = issue.path.join(".");
            const message = t(issue.message);
            errors.push({ row: from + idx, field: field || "(root)", error: message });
          }
        }
      });

      return { errors, valid };
    },
    [t],
  );

  const resetState = useCallback(() => {
    setStep(1);
    setFile(null);
    setFileError(undefined);
    setParsedData([]);
    setRowCount(0);
    setFromRow(1);
    setToRow(100);
    setRangeError(undefined);
    setMissingColumns([]);
    setMetaColumnCount(0);
    setValidationErrors([]);
    setValidatedRows([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFileChange = useCallback(
    (selected: File | null) => {
      if (!selected) {
        setFile(null);
        setFileError(undefined);
        return;
      }

      const ext = `.${selected.name.split(".").pop()?.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(t("userImport.invalidExtension"));
        return;
      }

      setFileError(undefined);
      setFile(selected);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          // Excel stores 1995-03-15 as the serial 34773; without cellDates it
          // reaches the ISO check as "34773" and only Text columns can import.
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            setFileError(t("userImport.parseError"));
            return;
          }
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null });
          if (json.length === 0) {
            setFileError(t("userImport.parseError"));
            return;
          }
          setParsedData(json);
          setRowCount(json.length);
          setFromRow(1);
          setToRow(Math.min(json.length, 100));
          setRangeError(undefined);
          setStep(2);
        } catch {
          setFileError(t("userImport.parseError"));
        }
      };
      reader.onerror = () => {
        setFileError(t("userImport.parseError"));
      };
      reader.readAsArrayBuffer(selected);
    },
    [t],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("userImport.title")}</DialogTitle>
          <DialogDescription>{t("userImport.description")}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <FileDropzone
              file={file}
              onChange={handleFileChange}
              accept={ALLOWED_EXTENSIONS.join(",")}
              icon={Upload}
              emptyLabel={t("userImport.supportedFormats")}
              hint={t("fileDropzone.dragDrop")}
              error={fileError}
            />

            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <div className="md:flex md:items-start md:gap-4">
                <div className="md:shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadTemplate(units ?? [], kind ?? "employee")}
                    className="flex items-center gap-2 rounded-lg border border-navy/20 bg-white px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    {t("userImport.exampleTable.title")}
                  </button>
                </div>
                <div className="mt-3 text-xs text-gray-500 md:mt-0">
                  <p>{t("userImport.customColumns.description")}</p>
                </div>
              </div>
            </div>
            {file && (
              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setFileError(undefined);
                    setStep(2);
                  }}
                >
                  {t("userImport.continue")}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 &&
          (() => {
            const previewCols = (() => {
              if (parsedData.length === 0) return FIXED_COLUMNS as readonly string[];
              const first = parsedData[0];
              const extra = Object.keys(first).filter(
                (h) => !(FIXED_COLUMNS as readonly string[]).includes(h.trim().toLowerCase()),
              );
              return [...FIXED_COLUMNS, ...extra] as readonly string[];
            })();

            const showFrom = fromRow >= 1 && fromRow <= rowCount && parsedData.length > 0;
            const showTo =
              toRow >= 1 && toRow <= rowCount && toRow !== fromRow && parsedData.length > 0;

            return (
              <div className="space-y-4">
                <p className="text-sm text-navy">
                  {t("userImport.rowsFound", { count: rowCount })}
                </p>

                <div className="flex items-end gap-4">
                  <div className="max-w-[8rem]">
                    <label className="mb-1 block text-sm font-medium text-navy">
                      {t("userImport.fromRow")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={rowCount}
                      value={fromRow}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(Number(e.target.value) || 1, rowCount));
                        setFromRow(val);
                        setRangeError(validateRange(val, toRow, rowCount));
                      }}
                    />
                    {rangeError && <p className="mt-1 text-xs text-error">{t(rangeError)}</p>}
                  </div>

                  <div className="max-w-[8rem]">
                    <label className="mb-1 block text-sm font-medium text-navy">
                      {t("userImport.toRow")}
                    </label>
                    <Input
                      type="number"
                      min={fromRow}
                      max={Math.min(fromRow + 99, rowCount)}
                      value={toRow}
                      onChange={(e) => {
                        const val = Math.max(
                          fromRow,
                          Math.min(
                            Number(e.target.value) || fromRow,
                            Math.min(fromRow + 99, rowCount),
                          ),
                        );
                        setToRow(val);
                        setRangeError(validateRange(fromRow, val, rowCount));
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400">{t("userImport.maxRows")}</p>

                {(showFrom || showTo) && (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {previewCols.map((col) => (
                            <TableHead key={col} className="text-[10px]">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {showFrom && (
                          <>
                            <TableRow>
                              <TableCell
                                className="text-[10px] font-medium text-gray-400"
                                colSpan={previewCols.length}
                              >
                                {t("userImport.previewRow", { row: fromRow })}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              {previewCols.map((col) => (
                                <TableCell key={col} className="text-xs">
                                  {String(parsedData[fromRow - 1]?.[col] ?? "")}
                                </TableCell>
                              ))}
                            </TableRow>
                          </>
                        )}
                        {showTo && (
                          <>
                            <TableRow>
                              <TableCell
                                className="text-[10px] font-medium text-gray-400"
                                colSpan={previewCols.length}
                              >
                                {t("userImport.previewRow", { row: toRow })}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              {previewCols.map((col) => (
                                <TableCell key={col} className="text-xs">
                                  {String(parsedData[toRow - 1]?.[col] ?? "")}
                                </TableCell>
                              ))}
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStep(1);
                      setRangeError(undefined);
                    }}
                  >
                    {t("userImport.back")}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!!rangeError}
                    onClick={() => {
                      const result = buildRowsFromParsed(parsedData, fromRow, toRow);
                      setMissingColumns(result.missing);
                      setMetaColumnCount(result.metaCount);
                      const { errors, valid } = validateRows(result.rows, fromRow);
                      // Parse errors first: a row that failed unit resolution is
                      // also missing unit_id, so its schema error reads as noise.
                      setValidationErrors([...result.errors, ...errors]);
                      setValidatedRows(valid);
                      setStep(3);
                    }}
                  >
                    {t("userImport.continue")}
                  </Button>
                </div>
              </div>
            );
          })()}

        {step === 3 && (
          <div className="space-y-4">
            {missingColumns.length > 0 ? (
              <div className="rounded-lg border border-error/20 bg-error/5 p-4">
                <p className="text-sm font-medium text-error">
                  {t("userImport.missingColumns", {
                    columns: missingColumns.join(", "),
                  })}
                </p>
              </div>
            ) : validationErrors.length > 0 ? (
              <>
                <div className="rounded-lg border border-error/20 bg-error/5 p-4">
                  <p className="text-sm font-medium text-error">
                    {t("userImport.validation.errorsFound", {
                      count: validationErrors.length,
                    })}
                  </p>
                </div>
                <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">
                          {t("userImport.validation.rowLabel")}
                        </TableHead>
                        <TableHead>{t("userImport.validation.field")}</TableHead>
                        <TableHead>{t("userImport.validation.error")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationErrors.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">{err.row}</TableCell>
                          <TableCell className="font-mono text-xs">{err.field}</TableCell>
                          <TableCell className="text-xs text-error">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-medium text-green-700">
                  {t("userImport.validation.success", {
                    count: validatedRows.length,
                  })}
                </p>
                {metaColumnCount > 0 && (
                  <p className="mt-1 text-xs text-green-600">
                    {t("userImport.customColumns", { count: metaColumnCount })}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setValidationErrors([]);
                  setValidatedRows([]);
                  setStep(2);
                }}
              >
                {t("userImport.back")}
              </Button>
              <Button
                variant="primary"
                disabled={validationErrors.length > 0 || missingColumns.length > 0}
                onClick={() => setStep(4)}
              >
                {t("userImport.continue")}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Card className="space-y-3 p-4">
              <h3 className="font-sans text-lg font-bold">{t("userImport.confirm.title")}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("userImport.confirm.file")}</span>
                  <span className="font-medium text-navy">{file?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("userImport.confirm.rows")}</span>
                  <span className="font-medium text-navy">{validatedRows.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("userImport.confirm.range")}</span>
                  <span className="font-medium text-navy">
                    {fromRow}–{toRow}
                  </span>
                </div>
                {metaColumnCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("userImport.confirm.metaColumns")}</span>
                    <span className="font-medium text-navy">{metaColumnCount}</span>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                {t("userImport.back")}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onImport(validatedRows);
                  handleClose();
                }}
              >
                {t("userImport.confirm.import", { count: validatedRows.length })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
