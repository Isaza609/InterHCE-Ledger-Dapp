"use strict";
/**
 * Cliente HTTP para el servidor HAPI FHIR.
 * Usado por fhirStorageService para persistir y recuperar recursos FHIR.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFhirConfigured = isFhirConfigured;
exports.getFhirBaseUrl = getFhirBaseUrl;
exports.postResource = postResource;
exports.getResource = getResource;
exports.putResource = putResource;
exports.searchResources = searchResources;
exports.deleteResource = deleteResource;
const FHIR_BASE_URL = process.env.FHIR_BASE_URL?.replace(/\/$/, "") ?? "";
const HEADERS = { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" };
function isFhirConfigured() {
    return FHIR_BASE_URL.length > 0;
}
function getFhirBaseUrl() {
    return FHIR_BASE_URL;
}
/**
 * POST de un recurso a HAPI FHIR. Devuelve el recurso tal como lo devolvió el servidor (con id asignado).
 */
async function postResource(resource) {
    const url = `${FHIR_BASE_URL}/${resource.resourceType}`;
    const res = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(resource)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`FHIR POST ${resource.resourceType} failed: ${res.status} ${text}`);
    }
    const data = (await res.json());
    return data;
}
/**
 * GET de un recurso por tipo e id.
 */
async function getResource(resourceType, id) {
    const url = `${FHIR_BASE_URL}/${resourceType}/${id}`;
    const res = await fetch(url, { method: "GET", headers: HEADERS });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`FHIR GET ${resourceType}/${id} failed: ${res.status} ${text}`);
    }
    return (await res.json());
}
/**
 * PUT de un recurso (actualización). El recurso debe incluir el id.
 */
async function putResource(resource) {
    const { resourceType, id } = resource;
    if (!id)
        throw new Error("PUT requires resource.id");
    const url = `${FHIR_BASE_URL}/${resourceType}/${id}`;
    const res = await fetch(url, {
        method: "PUT",
        headers: HEADERS,
        body: JSON.stringify(resource)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`FHIR PUT ${resourceType}/${id} failed: ${res.status} ${text}`);
    }
    return (await res.json());
}
/**
 * Búsqueda de recursos por tipo y parámetros. Devuelve el Bundle de búsqueda.
 */
async function searchResources(resourceType, params) {
    const search = new URLSearchParams(params).toString();
    const url = `${FHIR_BASE_URL}/${resourceType}?${search}`;
    const res = await fetch(url, { method: "GET", headers: HEADERS });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`FHIR search ${resourceType} failed: ${res.status} ${text}`);
    }
    return (await res.json());
}
/**
 * DELETE de un recurso por tipo e id.
 */
async function deleteResource(resourceType, id) {
    const url = `${FHIR_BASE_URL}/${resourceType}/${id}`;
    const res = await fetch(url, { method: "DELETE", headers: HEADERS });
    if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`FHIR DELETE ${resourceType}/${id} failed: ${res.status} ${text}`);
    }
}
