type FieldError = { message?: string };

export function errorMessage(fieldError: FieldError | unknown | undefined): string | undefined {
  if (fieldError && typeof fieldError === "object" && "message" in fieldError) {
    return (fieldError as { message?: string }).message;
  }
  return undefined;
}
