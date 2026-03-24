## HU4-E3. Permitir la consulta de trazabilidad según rol autorizado

### 1. Objetivo
Habilitar la consulta de trazabilidad únicamente para roles autorizados, sin exponer contenido clínico sensible.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU4-E3).
- El auditor puede consultar eventos de trazabilidad e integridad, pero no documento clínico off-chain.
- Los actores no auditores quedan limitados al alcance de sus episodios e IPS.

### 3. Implementación validada
- Backend:
  - `backend/src/routes/episodes.ts` (`GET /episodes/traceability/search`, `GET /episodes/:id/traceability`)
  - `backend/src/hce/trazabilidadService.ts`
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`
  - `frontend/src/app/router.tsx`
  - `frontend/src/shared/auth/capabilities.ts`

### 4. Casos funcionales
1. Auditor consulta eventos por episodio, tipo o IPS.
2. Profesional o admin IPS solo ven trazabilidad dentro de su alcance autorizado.
3. La vista presenta evidencia verificable sin mostrar documento clínico.

### 5. Casos de validación
1. Rol sin capacidad `trazabilidad.consultar` -> bloqueo en router y backend.
2. No auditor intentando consultar fuera de su IPS -> rechazo.
3. Auditor intentando ver documento clínico -> bloqueo por capacidad/permisos.

### 6. Resultado
- Consulta solo por roles autorizados: **CUMPLIDO**.
- Trazabilidad sin exposición clínica sensible: **CUMPLIDO**.
- Restricción por alcance institucional: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/TrazabilidadEpisodioPage.tsx`.
