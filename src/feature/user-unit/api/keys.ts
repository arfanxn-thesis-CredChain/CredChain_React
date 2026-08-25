export const userUnitKeys = {
  /** Prefix covering every search variant — what mutations invalidate. */
  all: () => ["user-units"] as const,
  list: (search?: string) => ["user-units", { search: search || undefined }] as const,
};
