"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listarIps = listarIps;
exports.listarIpsActivas = listarIpsActivas;
exports.obtenerIps = obtenerIps;
exports.existeIps = existeIps;
exports.crearIps = crearIps;
exports.actualizarIps = actualizarIps;
exports.actorPuedeGestionarIps = actorPuedeGestionarIps;
const ipsStore = new Map();
function nowIso() {
    return new Date().toISOString();
}
function seedIpsIniciales() {
    const base = [
        {
            ipsId: "IPS-001",
            nombre: "IPS Ejemplo Bogotá",
            repsCodigo: "110011001100",
            direccion: "Calle 100 #15-20",
            ciudad: "Bogotá",
            departamento: "Cundinamarca",
            telefono: "6011234567",
            correoContacto: "contacto@ips001.local",
            activa: true,
            creadaEn: nowIso(),
            actualizadaEn: nowIso()
        },
        {
            ipsId: "IPS-002",
            nombre: "IPS Ejemplo Medellín",
            repsCodigo: "050050050050",
            direccion: "Carrera 43A #1-50",
            ciudad: "Medellín",
            departamento: "Antioquia",
            telefono: "6049876543",
            correoContacto: "contacto@ips002.local",
            activa: true,
            creadaEn: nowIso(),
            actualizadaEn: nowIso()
        }
    ];
    for (const ips of base) {
        if (!ipsStore.has(ips.ipsId)) {
            ipsStore.set(ips.ipsId, ips);
        }
    }
}
seedIpsIniciales();
function listarIps() {
    return [...ipsStore.values()];
}
function listarIpsActivas() {
    return [...ipsStore.values()].filter((i) => i.activa);
}
function obtenerIps(ipsId) {
    return ipsStore.get(ipsId.trim());
}
function existeIps(ipsId) {
    return ipsStore.has(ipsId.trim());
}
function crearIps(input) {
    const ipsId = input.ipsId.trim();
    const nombre = input.nombre.trim();
    const repsCodigo = input.repsCodigo.trim();
    if (!ipsId || !nombre || !repsCodigo) {
        return { ok: false, message: "ipsId, nombre y repsCodigo son obligatorios." };
    }
    if (ipsStore.has(ipsId)) {
        return { ok: false, message: "Ya existe una IPS con ese ipsId." };
    }
    const ips = {
        ipsId,
        nombre,
        repsCodigo,
        direccion: input.direccion?.trim() ?? "",
        ciudad: input.ciudad?.trim() ?? "",
        departamento: input.departamento?.trim() ?? "",
        telefono: input.telefono?.trim() ?? "",
        correoContacto: input.correoContacto?.trim() ?? "",
        activa: true,
        creadaEn: nowIso(),
        actualizadaEn: nowIso()
    };
    ipsStore.set(ipsId, ips);
    return { ok: true, ips };
}
function actualizarIps(ipsId, patch) {
    const found = ipsStore.get(ipsId.trim());
    if (!found) {
        return { ok: false, message: "IPS no encontrada." };
    }
    const updated = {
        ...found,
        nombre: patch.nombre?.trim() || found.nombre,
        repsCodigo: patch.repsCodigo?.trim() || found.repsCodigo,
        direccion: patch.direccion?.trim() ?? found.direccion,
        ciudad: patch.ciudad?.trim() ?? found.ciudad,
        departamento: patch.departamento?.trim() ?? found.departamento,
        telefono: patch.telefono?.trim() ?? found.telefono,
        correoContacto: patch.correoContacto?.trim() ?? found.correoContacto,
        activa: patch.activa ?? found.activa,
        actualizadaEn: nowIso()
    };
    ipsStore.set(ipsId, updated);
    return { ok: true, ips: updated };
}
function actorPuedeGestionarIps(actor) {
    return actor.rol === "super_admin";
}
