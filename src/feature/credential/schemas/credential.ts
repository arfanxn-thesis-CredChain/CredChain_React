import { z } from "zod";
import { metaEntriesSchema } from "@shared/lib/meta";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const credentialFileSchema = z.custom<File | null>().superRefine((f, ctx) => {
  if (!(f instanceof File)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "zod.credential.fileRequired",
    });
    return;
  }
  if (f.size > MAX_FILE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "zod.credential.fileTooLarge",
    });
  }
  if (!ALLOWED_MIME_TYPES.has(f.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "zod.credential.fileTypeInvalid",
    });
  }
});

export const credentialIssueRowSchema = z.object({
  holder_user_id: z
    .string()
    .min(1, "zod.credential.holderRequired")
    .refine((v) => v !== "new_holder", { message: "zod.credential.holderRequired" }),
  name: z.string().min(1, "zod.credential.nameRequired").max(256, "zod.credential.nameTooLong"),
  meta_entries: metaEntriesSchema.optional(),
  file: credentialFileSchema,
});

export type CredentialIssueRowInput = z.infer<typeof credentialIssueRowSchema>;

export const credentialBatchIssueSchema = z.object({
  credentials: z
    .array(credentialIssueRowSchema)
    .min(1, "zod.credential.batchMinOne")
    .max(100, "zod.credential.batchMaxHundred"),
});

export type CredentialBatchIssueInput = z.infer<typeof credentialBatchIssueSchema>;

export const credentialSubmitRowSchema = z.object({
  name: z.string().min(1, "zod.credential.nameRequired").max(256, "zod.credential.nameTooLong"),
  type_id: z.string().min(1, "zod.credential.typeRequired"),
  issuer_organization_id: z.string().min(1, "zod.credential.issuerOrganizationRequired"),
  issued_at: z
    .string()
    .min(1, "zod.credential.issuedAtRequired")
    .regex(ISO_DATE, "zod.credential.dateFormat"),
  number: z.string().max(256, "zod.credential.numberTooLong").optional(),
  expires_at: z.string().regex(ISO_DATE, "zod.credential.dateFormat").optional().or(z.literal("")),
  competency_ids: z.array(z.string().min(1)).optional(),
  meta_entries: metaEntriesSchema.optional(),
  file: credentialFileSchema,
});

export type CredentialSubmitRowInput = z.infer<typeof credentialSubmitRowSchema>;

export const credentialBatchSubmitSchema = z.object({
  credentials: z
    .array(credentialSubmitRowSchema)
    .min(1, "zod.credential.batchMinOne")
    .max(100, "zod.credential.batchMaxHundred"),
});

export type CredentialBatchSubmitInput = z.infer<typeof credentialBatchSubmitSchema>;

export function defaultCredentialSubmitRow(): CredentialSubmitRowInput {
  return {
    name: "",
    type_id: "",
    issuer_organization_id: "",
    issued_at: "",
    number: "",
    expires_at: "",
    competency_ids: [],
    meta_entries: [],
    file: null,
  };
}

export const credentialBatchRevokeSchema = z.object({
  ids: z
    .array(z.string().min(1, "zod.credential.idRequired"))
    .min(1, "zod.credential.revokeMinOne")
    .max(100, "zod.credential.revokeMaxHundred"),
});

export type CredentialBatchRevokeInput = z.infer<typeof credentialBatchRevokeSchema>;

export function defaultCredentialIssueRow(): CredentialIssueRowInput {
  return {
    holder_user_id: "",
    name: "",
    meta_entries: [],
    file: null,
  };
}

export const verifyFileSchema = z.custom<File>().superRefine((f, ctx) => {
  if (!(f instanceof File)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "zod.credential.fileRequired",
    });
    return;
  }
  if (f.size > MAX_FILE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "zod.credential.fileTooLarge",
    });
  }
  if (!ALLOWED_MIME_TYPES.has(f.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "zod.credential.fileTypeInvalid",
    });
  }
});
