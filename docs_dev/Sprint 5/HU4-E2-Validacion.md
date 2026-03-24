## HU4-E2. Mantener la continuidad asistencial del episodio clínico entre IPS

### 1. Objetivo
Permitir que el mismo episodio continúe su ciclo de vida entre IPS distintas sin perder identidad, historial ni trazabilidad.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU4-E2).
- La continuidad exige permiso vigente para la IPS que continúa el caso.
- El evento de urgencias y el identificador del episodio no pueden cambiar durante actualizaciones.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/episodioLifecycleService.ts`
  - `backend/src/hce/permisosEpisodioService.ts`
  - `backend/src/routes/episodes.ts` (`GET /episodes/:id/traceability` y `PUT /episodes/:id`)
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`
  - `frontend/src/pages/VerEpisodioPage.tsx`

### 4. Casos funcionales
1. IPS origen crea episodio y conserva propiedad inicial.
2. IPS receptora recibe permiso y actualiza el mismo episodio.
3. La trazabilidad muestra IPS propietaria e IPS involucradas sin fragmentar el caso.

### 5. Casos de validación
1. La actualización de una IPS sin permiso vigente se bloquea.
2. El `episodeId` y `eventoUrgenciasId` se mantienen tras la continuidad.
3. El historial de versiones registra al actor de la IPS receptora.

### 6. Resultado
- Identificador único estable durante todo el ciclo de vida: **CUMPLIDO**.
- Participación multi-IPS trazable: **CUMPLIDO**.
- Continuidad asistencial verificable sin duplicación: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/TrazabilidadEpisodioPage.tsx` y `frontend/src/pages/VerEpisodioPage.tsx`.
