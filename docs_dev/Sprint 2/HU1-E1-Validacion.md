## HU1-E1. Actualizar episodio clinico durante la atencion de urgencias

### 1. Objetivo de la HU

Validar que una actualizacion de episodio genera nueva version clinica trazable, con nuevo hash on-chain, sin sobrescribir ni eliminar versiones previas.

### 2. Alcance y supuestos (normativa + FHIR)

- Referencia funcional: `docs_plan/3. Epicas e HU.md` (HU1-E1).
- Requisitos asociados: RF2, RF7, RF8, RF11; RNF1 y RNF3.
- Referencias normativas: `docs_plan/5. Referencias Normativas.md` (integridad, trazabilidad, privacidad).
- Supuesto tecnico: actualizacion requiere rol autorizado y mismo contexto de evento/IPS origen para conservar asociacion episodio-evento.

### 3. Implementacion validada

- Backend:
  - `backend/src/routes/episodes.ts` (`PUT /episodes/:id`, `GET /episodes/:id/versions`, `GET /episodes/:id/traceability`).
  - `backend/src/hce/episodioLifecycleService.ts` (versionado incremental, historial inmutable, control IPS en actualizacion).
  - `backend/src/hce/documentoClinicoService.ts` (recalculo hash por version).
- Frontend:
  - `frontend/src/pages/ActualizarEpisodioPage.tsx` (flujo HU1-E1).
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx` (consulta de historial de versiones).
  - `frontend/src/shared/services/api.ts` (`actualizarEpisodio`, `obtenerVersionesEpisodio`, `obtenerTrazabilidadEpisodio`).
- Tests:
  - `backend/test/sprint2-hus.test.js` (caso HU1-E1 versionado e historial).

### 4. Casos de prueba funcionales

1. Actualizacion valida crea nueva version
- Precondicion: episodio existente con version 1.
- Pasos: ejecutar `PUT /episodes/:id` con payload valido y cambios clinicos.
- Resultado esperado: respuesta exitosa con `version=2`, nuevo `documentHash`.

2. Historial completo consultable
- Precondicion: episodio con multiples actualizaciones.
- Pasos: consultar `GET /episodes/:id/versions` y `GET /episodes/:id/traceability`.
- Resultado esperado: lista ordenada de versiones, actor y hash por version.

### 5. Casos de validacion

1. Actualizacion sin autorizacion de rol
- Entrada: rol `paciente` o `auditor`.
- Esperado: `403 FORBIDDEN_ROLE`.

2. Episodio inexistente en trazabilidad
- Entrada: `PUT /episodes/:id` para id no registrado.
- Esperado: `404 EPISODE_NOT_FOUND`.

3. IPS del actor no autorizada para ese episodio
- Entrada: `x-ips-id` distinto al de la asociacion original.
- Esperado: `403 FORBIDDEN_IPS_UPDATE`.

### 6. Criterios de aceptacion y resultado

- Solo usuarios autorizados actualizan: **CUMPLIDO**.
- Cada actualizacion genera nueva version: **CUMPLIDO**.
- Versiones previas no se sobrescriben ni eliminan: **CUMPLIDO**.
- Cada version genera nuevo hash para trazabilidad on-chain: **CUMPLIDO**.
- Historial completo trazable: **CUMPLIDO**.

### 7. Evidencia de ejecucion

- Pruebas automatizadas: `cd backend && npm test`.
- Flujo UI: `frontend/src/pages/ActualizarEpisodioPage.tsx` + `TrazabilidadEpisodioPage.tsx`.
