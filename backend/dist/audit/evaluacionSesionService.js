"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.iniciarNuevaSesion = iniciarNuevaSesion;
exports.obtenerSesionActual = obtenerSesionActual;
exports.listarSesiones = listarSesiones;
exports.obtenerSesionPorId = obtenerSesionPorId;
const crypto_1 = require("crypto");
const jsonFileStore_1 = require("../shared/jsonFileStore");
const STORE_FILE = "evaluacion-sesion.json";
// ─── Persistencia ─────────────────────────────────────────────────────────────
function cargarSesiones() {
    return (0, jsonFileStore_1.loadJsonFile)(STORE_FILE, []);
}
function guardarSesiones(sesiones) {
    (0, jsonFileStore_1.saveJsonFile)(STORE_FILE, sesiones);
}
// ─── API pública ──────────────────────────────────────────────────────────────
/**
 * Crea una nueva sesión de evaluación y la persiste.
 * La sesión anterior NO se elimina; se puede recuperar para comparaciones históricas.
 */
function iniciarNuevaSesion(opciones) {
    const sesion = {
        id: (0, crypto_1.randomUUID)(),
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
function obtenerSesionActual() {
    const sesiones = cargarSesiones();
    if (!sesiones.length)
        return null;
    return sesiones[sesiones.length - 1];
}
/**
 * Devuelve todas las sesiones ordenadas de más reciente a más antigua.
 */
function listarSesiones() {
    return cargarSesiones().slice().reverse();
}
/**
 * Devuelve la sesión con el id indicado, o null si no existe.
 */
function obtenerSesionPorId(id) {
    return cargarSesiones().find((s) => s.id === id) ?? null;
}
