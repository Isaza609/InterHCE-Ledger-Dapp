import { API_BASE_URL } from "@/shared/utils/constants";
import type { EpisodioPayload, ValidationResult } from "@/shared/types/episodio";

const episodesBase = `${API_BASE_URL}/episodes`;

async function parseJson<T>(res: Response): Promise<T> {
  return res.json().catch(() => ({} as T));
}

const CONNECTION_ERROR =
  "No se pudo conectar con el backend. Compruebe que esté en ejecución (puerto 3001) y que la URL sea correcta.";

/** Valida un episodio contra el modelo de HCE (POST /episodes/validate). */
export async function validarEpisodio(
  payload: EpisodioPayload
): Promise<ValidationResult> {
  try {
    const res = await fetch(`${episodesBase}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await parseJson<{
      code: string;
      message: string;
      details?: { field: string; issue: string }[];
      data?: EpisodioPayload;
    }>(res);
    if (res.ok) {
      return { valid: true, message: data.message, data: data.data };
    }
    return {
      valid: false,
      message: data.message ?? "Error de validación",
      details: data.details ?? []
    };
  } catch {
    return { valid: false, message: CONNECTION_ERROR, details: [] };
  }
}

/** Registra un episodio (POST /episodes). El backend valida antes de aceptar. Devuelve episodeId y documentHash en éxito. */
export async function registrarEpisodio(
  payload: EpisodioPayload
): Promise<ValidationResult> {
  try {
    const res = await fetch(episodesBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await parseJson<{
      code: string;
      message: string;
      details?: { field: string; issue: string }[];
      data?: EpisodioPayload;
      episodeId?: string;
      documentHash?: string;
    }>(res);
    if (res.ok) {
      return {
        valid: true,
        message: data.message,
        data: data.data,
        episodeId: data.episodeId,
        documentHash: data.documentHash
      };
    }
    return {
      valid: false,
      message: data.message ?? "Error al registrar",
      details: data.details ?? []
    };
  } catch {
    return { valid: false, message: CONNECTION_ERROR, details: [] };
  }
}

export interface EpisodioResumen {
  episodeId: string;
  documentHash?: string;
}

/** Lista todos los episodios registrados. GET /episodes/list */
export async function listarTodosLosEpisodios(): Promise<{
  episodes: EpisodioResumen[];
  message: string;
}> {
  const res = await fetch(`${episodesBase}/list`);
  const data = await parseJson<{
    code: string;
    message: string;
    episodes?: EpisodioResumen[];
  }>(res);
  if (!res.ok) {
    return { episodes: [], message: data.message ?? "Error al listar" };
  }
  return {
    episodes: data.episodes ?? [],
    message: data.message ?? ""
  };
}

/** Busca episodios por identificador del paciente (cédula/documento). GET /episodes?patientIdentifier=xxx */
export async function buscarEpisodiosPorPaciente(
  patientIdentifier: string
): Promise<{ episodes: EpisodioResumen[]; message: string }> {
  const res = await fetch(
    `${episodesBase}?${new URLSearchParams({ patientIdentifier: patientIdentifier.trim() })}`
  );
  const data = await parseJson<{
    code: string;
    message: string;
    episodes?: EpisodioResumen[];
  }>(res);
  if (!res.ok) {
    return { episodes: [], message: data.message ?? "Error al buscar" };
  }
  return {
    episodes: data.episodes ?? [],
    message: data.message ?? ""
  };
}

/** Obtiene el documento clínico de un episodio. GET /episodes/:id/document */
export async function obtenerDocumentoEpisodio(episodeId: string): Promise<{
  episodeId: string;
  hash: string;
  createdAt: string;
  document: EpisodioPayload;
} | null> {
  const res = await fetch(`${episodesBase}/${encodeURIComponent(episodeId)}/document`);
  if (!res.ok) return null;
  const data = await parseJson<{
    episodeId: string;
    hash: string;
    createdAt: string;
    document: EpisodioPayload;
  }>(res);
  return data;
}
