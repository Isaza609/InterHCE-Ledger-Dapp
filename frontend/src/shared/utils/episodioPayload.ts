import type { EpisodioPayload } from "@/shared/types/episodio";

/**
 * Convierte date (YYYY-MM-DD) y time (HH:mm o HH:mm:ss) en datetime sin zona.
 * Formato salida: YYYY-MM-DDTHH:mm:ss (válido para Zod .datetime({ offset: false })).
 */
export function toDateTimeLocal(date: string, time: string): string {
  const d = (date ?? "").trim();
  if (!d) return "";
  const raw = (time ?? "").trim() || "00:00";
  const parts = raw.split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  const s = parts[2]?.padStart(2, "0") ?? "00";
  return `${d}T${h}:${m}:${s}`;
}

/**
 * Prepara el payload para el backend: quita campos opcionales vacíos
 * que podrían fallar validación (ej. period.end vacío).
 */
export function buildEpisodioPayload(data: EpisodioPayload): EpisodioPayload {
  const period = {
    start: data.encounter.period.start,
    ...(data.encounter.period.end?.trim()
      ? { end: data.encounter.period.end.trim() }
      : {})
  };
  return {
    ...data,
    encounter: {
      ...data.encounter,
      period
    }
  };
}
