/***************************************************************************************
 * @file server/constants/errorCodes.ts
 * @description
 *   Centralizes machine-readable error codes and HTTP status mapping for the BFF layer.
 *   This file defines a small, stable taxonomy used by all server endpoints and helpers
 *   to communicate authorization and token errors in a consistent way. Using a single
 *   source for codes prevents drift across routes and makes client behavior predictable,
 *   especially when showing modals or downgrading UI modes. The mapping helper
 *   `statusForError` returns sensible defaults, while remaining easy to extend later.
 *   These codes intentionally avoid including sensitive or dynamic context so they can
 *   be safely logged and surfaced to clients as structured data for telemetry or UI.
 *   Keep additions backwards compatible to avoid breaking existing consumers.
 ***************************************************************************************/

export enum ErrorCode {
  // ACL / Authorization
  ACL_DENIED_READ = 'ACL_DENIED_READ',
  ACL_DENIED_EDIT = 'ACL_DENIED_EDIT',
  ACL_PUBLIC_EDIT_OFF = 'ACL_PUBLIC_EDIT_OFF',
  ACL_MEMBERSHIP_REMOVED = 'ACL_MEMBERSHIP_REMOVED',
  ACL_DENIED_READ_USERDATA = 'ACL_DENIED_READ_USERDATA',

  // Tokens / Transport
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  DOC_MISMATCH = 'DOC_MISMATCH',

  // Resource / Session
  DOC_NOT_FOUND = 'DOC_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

/**
 * @function statusForError
 * @description
 *   Maps a machine-readable ErrorCode to an HTTP status number that matches typical
 *   expectations of clients, middleware, and logs. This helper ensures we do not
 *   hardcode ad-hoc status codes throughout route handlers. You can extend this
 *   function safely: unknown codes default to 400 (Bad Request) to prevent accidental
 *   masking as 200-OK. Prefer 401 for authentication problems, 403 for authorization
 *   denials, 404 for missing resources, and 410 if you later add “gone” semantics.
 */
export function statusForError(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.TOKEN_EXPIRED:
    case ErrorCode.INVALID_TOKEN:
      return 401;

    case ErrorCode.ACL_DENIED_READ:
    case ErrorCode.ACL_DENIED_EDIT:
    case ErrorCode.ACL_PUBLIC_EDIT_OFF:
    case ErrorCode.ACL_MEMBERSHIP_REMOVED:
    case ErrorCode.ACL_DENIED_READ_USERDATA:
    case ErrorCode.DOC_MISMATCH:
      return 403;

    case ErrorCode.DOC_NOT_FOUND:
      return 404;

    default:
      return 400;
  }
}
