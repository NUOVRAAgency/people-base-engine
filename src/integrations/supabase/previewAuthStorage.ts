// Auth session storage for the Supabase client.
// Uses localStorage in the browser; returns undefined during SSR so the
// client falls back to in-memory storage on the server.
export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return localStorage;
}
