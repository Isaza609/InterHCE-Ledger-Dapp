/**
 * Servicio de sesiones de evaluación.
 *
 * Permite al auditor "iniciar nueva sesión", lo que guarda un snapshot
 * (timestamp + bloque de referencia) en backend/data/evaluacion-sesion.json.
 *
 * Al listar métricas, se puede filtrar por sesionId para ver solo las
 * evaluaciones generadas desde ese punto en adelante.
 *
 * No borra transacciones de blockchain (eso es imposible); solo define un
 * punto de inicio a partir del cual se consideran nuevas las métricas.
 */

import { randomUUID } from "crypto";
import { loadJsonFile, saveJsonFile } from "../shared/jsonFileStore";

const STORE_FILE = "evaluacion-sesion.json";

export interface EvaluacionSesion {
  id: string;
  /** Momento en que se inició la sesión (ISO 8601) */
  startedAt: string;
  /** Etiqueta libre para identificar la sesión */
  label: string;
  /** Número del último bloque conocido al iniciar la sesión (si el nodo estaba accesible) */
  startBlockRef?: number;
  /** Quién inició la sesión */
  iniciadaPor?: string;
}

// ─── Persistencia ─────────────────────────────────────────────────────────────

function cargarSesiones(): EvaluacionSesion[] {
  return loadJsonFile<EvaluacionSesion[]>(STORE_FILE, []);
}

function guardarSesiones(sesiones: EvaluacionSesion[]): void {
  saveJsonFile(STORE_FILE, sesiones);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Crea una nueva sesión de evaluación y la persiste.
 * La sesión anterior NO se elimina; se puede recuperar para comparaciones históricas.
 */
export function iniciarNuevaSesion(
  opciones?: { label?: string; startBlockRef?: number; iniciadaPor?: string }
): EvaluacionSesion {
  const sesion: EvaluacionSesion = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    label: opciones?.label ?? `Sesión ${new Date().toLocaleString("es-CO")}`,
    startBlockRef: opciones?.startBlockRef,
    iniciadaPor: opciones?.iniciadaPor
  };

  const sesiones = cargarSesiones();
  sesiones.push(sesion);
  guardarSesiones(sesiones);
  return sesion;
}

/**
 * Devuelve la sesión más reciente, o null si no se ha iniciado ninguna.
 */
export function obtenerSesionActual(): EvaluacionSesion | null {
  const sesiones = cargarSesiones();
  if (!sesiones.length) return null;
  return sesiones[sesiones.length - 1];
}

/**
 * Devuelve todas las sesiones ordenadas de más reciente a más antigua.
 */
export function listarSesiones(): EvaluacionSesion[] {
  return cargarSesiones().slice().reverse();
}

/**
 * Devuelve la sesión con el id indicado, o null si no existe.
 */
export function obtenerSesionPorId(id: string): EvaluacionSesion | null {
  return cargarSesiones().find((s) => s.id === id) ?? null;
}
