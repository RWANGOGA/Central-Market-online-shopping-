/**
 * Global "any 401 means logged out" wiring.
 *
 * API clients (cartApi, customerApi) call triggerUnauthorized() when they
 * observe a 401 response. The AuthProvider registers a handler that clears
 * the session and redirects to the shop root. This keeps every API client
 * decoupled from the auth state while honouring "treat any 401 as logged out".
 */

let onUnauthorized: (() => void) | null = null;

export function registerAuthHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function triggerUnauthorized() {
  onUnauthorized?.();
}
