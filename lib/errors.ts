// Stable, client-safe error contract for database/RPC failures. Messages we
// raise deliberately (P0001, QZ429) are written for families and pass through;
// anything else (casts, constraint names, internals) is replaced and logged.
export type PublicError = { status: number; error: string; code: string };
type DbError = { code?: string; message: string } | null | undefined;

const GENERIC =
  "That request could not be completed. Check the details and try again.";

export function publicError(e: DbError, context: string): PublicError {
  const code = e?.code ?? "";
  if (code === "QZ429")
    return { status: 429, error: e!.message, code: "rate_limited" };
  if (code === "P0001")
    return { status: 400, error: e!.message, code: "rejected" };
  if (code === "28000" || code === "PGRST301")
    return {
      status: 401,
      error: "Please sign in again.",
      code: "unauthenticated",
    };
  if (code === "42501")
    return { status: 403, error: "Permission denied.", code: "forbidden" };
  // Unexpected: keep internals out of the response, but leave a trace for operators.
  console.warn(
    JSON.stringify({ event: "db_error", context, code, message: e?.message }),
  );
  return { status: 400, error: GENERIC, code: "invalid" };
}
