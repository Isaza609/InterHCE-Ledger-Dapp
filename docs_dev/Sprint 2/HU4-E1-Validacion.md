## HU4-E1. Asociar episodios clinicos a eventos de urgencias

### 1. Objetivo de la HU

Validar que cada episodio queda asociado a un unico evento de urgencias y que esa asociacion se mantiene durante todo su ciclo de vida, con metadatos trazables y verificables.

### 2. Alcance y supuestos (normativa + FHIR)

- Referencia funcional: `docs_plan/3. Epicas e HU.md` (HU4-E1).
- Requisitos asociados: RF1, RF2, RF7, RF11; RNF1.
- Referencias normativas: `docs_plan/5. Referencias Normativas.md`.
- Base FHIR: `Encounter.period.start` y `Organization.identifier` (IPS origen) usados como metadatos del evento.

### 3. Implementacion validada

- Backend:
  - `backend/src/hce/episodioLifecycleService.ts`:
    - genera `eventoUrgenciasId`.
    - conserva `fechaHoraInicio`, `ipsOrigenId`, `tipoAtencion`.
    - bloquea cambios de asociacion en actualizaciones.
  - `backend/src/routes/episodes.ts`:
    - `GET /episodes/:id/event`.
    - `GET /episodes/:id/traceability`.
    - control de conflicto `EVENT_ASSOCIATION_CONFLICT`.
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx` (vista de asociacion episodio-evento y versiones).
- Tests:
  - `backend/test/sprint2-hus.test.js` (caso de inmutabilidad de asociacion).

### 4. Casos de prueba funcionales

1. Asociacion unica al crear episodio
- Precondicion: crear episodio valido HU0-E1.
- Pasos: consultar `GET /episodes/:id/event`.
- Resultado esperado: evento unico con `eventoUrgenciasId`, `fechaHoraInicio`, `ipsOrigenId`, `tipoAtencion`.

2. Asociacion mantenida en ciclo de vida
- Precondicion: episodio con una o mas actualizaciones validas.
- Pasos: consultar `GET /episodes/:id/traceability`.
- Resultado esperado: el mismo evento en todas las versiones.

### 5. Casos de validacion

1. Intento de cambiar fecha/hora de inicio del evento
- Entrada: update con `encounter.period.start` diferente.
- Esperado: `409 EVENT_ASSOCIATION_CONFLICT`.

2. Intento de cambiar IPS origen del evento
- Entrada: update con `prestadorOrigen.identifier[0].value` diferente.
- Esperado: `409 EVENT_ASSOCIATION_CONFLICT`.

3. Consulta de evento para episodio no registrado
- Entrada: `GET /episodes/:id/event` inexistente.
- Esperado: `404 EVENT_NOT_FOUND`.

### 6. Criterios de aceptacion y resultado

- Cada episodio asociado a un unico evento de urgencias: **CUMPLIDO**.
- Asociacion mantenida durante todo el ciclo de vida: **CUMPLIDO**.
- Metadatos del evento registrados como parte del episodio: **CUMPLIDO**.
- Asociacion trazable y verificable: **CUMPLIDO**.

### 7. Evidencia de ejecucion

- Suite automatizada: `cd backend && npm test` (casos HU4-E1).
- Evidencia funcional UI: `frontend/src/pages/TrazabilidadEpisodioPage.tsx`.
