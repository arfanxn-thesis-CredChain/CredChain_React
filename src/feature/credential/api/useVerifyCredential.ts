import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@shared/api/client";
import { isApiError } from "@shared/api/envelope";
import type { CredentialVerifyDTO } from "@shared/types/api";

const integrityEnvelopeSchema = z.object({
  code: z.literal(400403),
  data: z.object({
    verdict_code: z.literal(400403),
    exact_match_confirmed: z.literal(false).default(false),
    public_details: z.null().optional(),
    description: z.string(),
    similarity_score: z
      .number()
      .min(0)
      .max(1)
      .nullish()
      .transform((value) => value ?? null),
    similarity_percent: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
    credential: z
      .object({
        id: z.string(),
        name: z.string(),
        status: z.enum(["pending", "approved", "rejected", "revoked", "expired"]),
        is_submission: z.boolean(),
        issuer_organization_id: z.string(),
        issuer_organization_name: z.string().nullable().default(null),
        credential_type_name: z.string().nullable().default(null),
        number: z.string().nullable(),
        file_hash: z.string(),
        issued_at: z.string(),
        expires_at: z.string().nullable(),
      })
      .nullish()
      .transform((value) => value ?? null),
  }),
});

export function useVerifyCredential() {
  return useMutation({
    mutationFn: async (file: File): Promise<CredentialVerifyDTO> => {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await api.post<CredentialVerifyDTO>("/credentials/verify", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
      } catch (error) {
        if (isApiError(error) && error.status === 409 && error.code === 400403) {
          const parsed = integrityEnvelopeSchema.safeParse(error.cause.response?.data);
          if (parsed.success) return parsed.data.data;
        }
        throw error;
      }
    },
  });
}
