/**
 * Application error model.
 *
 * Services throw `AppError` with a stable machine-readable `code`. The
 * `message` is either a short English developer fallback or — for
 * `validation` errors — a stable validation code (see `task-validation`);
 * the UI resolves both to localized copy via `src/i18n/errors.ts`.
 * Developer diagnostics must never include secrets or personal data, so raw
 * database errors are only surfaced through their `message` (never bound
 * parameter values).
 */

export type AppErrorCode =
  | 'validation'
  | 'not_found'
  | 'database'
  | 'conflict'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

