/** URL base del backend (InterHCE). */
const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

function buildDefaultApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }
  const host = window.location.hostname || "localhost";
  return `http://${host}:3001`;
}

/**
 * Prioriza VITE_API_BASE_URL (si existe). Si no, usa el mismo host del navegador
 * para evitar fallos cuando el frontend se abre por IP de red y no por localhost.
 */
export const API_BASE_URL =
  configuredApiBaseUrl.length > 0 ? configuredApiBaseUrl : buildDefaultApiBaseUrl();
