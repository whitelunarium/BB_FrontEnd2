// assets/js/utils/errors.js
// Responsibility: Centralized error type definitions and user-facing error messages.
// All JS files reference these constants — never scatter error strings elsewhere.

const API_BASE = 'http://localhost:8587';

// ─── Error type enum ──────────────────────────────────────────────────────────
const ERROR_TYPES = Object.freeze({
  AUTH_REQUIRED:    'AUTH_REQUIRED',
  FORBIDDEN:        'FORBIDDEN',
  NOT_FOUND:        'NOT_FOUND',
  INVALID_DATA:     'INVALID_DATA',
  HTTP_ERROR:       'HTTP_ERROR',
  NETWORK_ERROR:    'NETWORK_ERROR',
  SERVER_ERROR:     'SERVER_ERROR',
});

// ─── User-facing error messages ────────────────────────────────────────────────
const ERROR_MESSAGES = Object.freeze({
  [ERROR_TYPES.AUTH_REQUIRED]:  'Please sign in to continue.',
  [ERROR_TYPES.FORBIDDEN]:      'You do not have permission to do this.',
  [ERROR_TYPES.NOT_FOUND]:      'The requested resource was not found.',
  [ERROR_TYPES.INVALID_DATA]:   'Please check your information and try again.',
  [ERROR_TYPES.HTTP_ERROR]:     'Something went wrong. Please try again.',
  [ERROR_TYPES.NETWORK_ERROR]:  'Unable to connect. Check your internet connection.',
  [ERROR_TYPES.SERVER_ERROR]:   'An unexpected error occurred. Please try again later.',
  DEFAULT:                      'Something went wrong. Please try again.',
});

/**
 * Purpose: Resolve a user-facing message for a given error type.
 * @param {string} errorType - An ERROR_TYPES key
 * @returns {string} Human-readable error message
 * Algorithm:
 * 1. Look up the error type in ERROR_MESSAGES
 * 2. Return the match, or the DEFAULT message if not found
 */
function getErrorMessage(errorType) {
  return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.DEFAULT;
}

/**
 * Purpose: Map an HTTP status code to an ERROR_TYPES constant.
 * @param {number} status - HTTP response status code
 * @returns {string} Matching ERROR_TYPES key
 * Algorithm:
 * 1. Check status against known codes
 * 2. Return the appropriate type constant
 * 3. Default to HTTP_ERROR for unmapped codes
 */
function classifyHttpError(status) {
  if (status === 401) return ERROR_TYPES.AUTH_REQUIRED;
  if (status === 403) return ERROR_TYPES.FORBIDDEN;
  if (status === 404) return ERROR_TYPES.NOT_FOUND;
  if (status === 422) return ERROR_TYPES.INVALID_DATA;
  if (status >= 500)  return ERROR_TYPES.SERVER_ERROR;
  return ERROR_TYPES.HTTP_ERROR;
}

/**
 * Purpose: Escape a string for safe HTML rendering (prevent XSS).
 * @param {string} str - Raw string from API or user input
 * @returns {string} HTML-escaped string safe to inject via innerHTML
 * Algorithm:
 * 1. Replace & first (must be first to avoid double-escaping)
 * 2. Replace remaining special HTML characters
 * 3. Return escaped string
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Purpose: Validate that a fetch Response is OK; throw a typed error if not.
 * @param {Response} response - Fetch API response object
 * @returns {Response} The same response if status is OK
 * Algorithm:
 * 1. Check response.ok
 * 2. If not OK: classify the error type by status, throw with type and status
 * 3. If OK: return response for chaining
 */
function validateResponse(response) {
  if (!response.ok) {
    const errorType = classifyHttpError(response.status);
    const error = new Error(getErrorMessage(errorType));
    error.type = errorType;
    error.status = response.status;
    throw error;
  }
  return response;
}
