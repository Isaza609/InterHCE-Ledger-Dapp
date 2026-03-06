/**
 * Cliente HTTP para el servidor HAPI FHIR.
 * Usado por fhirStorageService para persistir y recuperar recursos FHIR.
 */

const FHIR_BASE_URL = process.env.FHIR_BASE_URL?.replace(/\/$/, "") ?? "";
const HEADERS = { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" };

export function isFhirConfigured(): boolean {
  return FHIR_BASE_URL.length > 0;
}

export function getFhirBaseUrl(): string {
  return FHIR_BASE_URL;
}

interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * POST de un recurso a HAPI FHIR. Devuelve el recurso tal como lo devolvió el servidor (con id asignado).
 */
export async function postResource<T extends FhirResource>(resource: T): Promise<T> {
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
  const data = (await res.json()) as T;
  return data;
}

/**
 * GET de un recurso por tipo e id.
 */
export async function getResource<T extends FhirResource>(
  resourceType: string,
  id: string
): Promise<T> {
  const url = `${FHIR_BASE_URL}/${resourceType}/${id}`;
  const res = await fetch(url, { method: "GET", headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR GET ${resourceType}/${id} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * PUT de un recurso (actualización). El recurso debe incluir el id.
 */
export async function putResource<T extends FhirResource>(resource: T): Promise<T> {
  const { resourceType, id } = resource;
  if (!id) throw new Error("PUT requires resource.id");
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
  return (await res.json()) as T;
}

/**
 * Búsqueda de recursos por tipo y parámetros. Devuelve el Bundle de búsqueda.
 */
export async function searchResources(
  resourceType: string,
  params: Record<string, string>
): Promise<{ entry?: Array<{ resource: FhirResource }> }> {
  const search = new URLSearchParams(params).toString();
  const url = `${FHIR_BASE_URL}/${resourceType}?${search}`;
  const res = await fetch(url, { method: "GET", headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR search ${resourceType} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as { entry?: Array<{ resource: FhirResource }> };
}

/**
 * DELETE de un recurso por tipo e id.
 */
export async function deleteResource(resourceType: string, id: string): Promise<void> {
  const url = `${FHIR_BASE_URL}/${resourceType}/${id}`;
  const res = await fetch(url, { method: "DELETE", headers: HEADERS });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`FHIR DELETE ${resourceType}/${id} failed: ${res.status} ${text}`);
  }
}
