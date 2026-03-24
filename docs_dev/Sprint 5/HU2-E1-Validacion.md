## HU2-E1. Consultar episodios clínicos asociados a un paciente

### 1. Objetivo
Permitir que un profesional autorizado consulte los episodios asociados al identificador de un paciente sin exponer información a actores no autorizados.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU2-E1).
- La búsqueda parte del identificador del paciente y luego filtra por permisos vigentes del actor.
- La consulta devuelve metadatos y navegación a documento off-chain, no contenido clínico on-chain.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/documentoClinicoService.ts`
  - `backend/src/routes/episodes.ts` (`GET /episodes`)
- Frontend:
  - `frontend/src/pages/EpisodiosPage.tsx`
  - `frontend/src/pages/PacientesPage.tsx`

### 4. Casos funcionales
1. Profesional de salud busca por documento del paciente y obtiene solo episodios autorizados.
2. El resultado conserva metadatos clínicos resumidos y el identificador del episodio.
3. El flujo permite navegar a consulta documental o trazabilidad según capacidad del rol.

### 5. Casos de validación
1. Búsqueda vacía -> rechazo por parámetro faltante.
2. Actor sin autorización efectiva sobre el episodio -> el episodio no aparece en resultados.
3. El resumen no depende del contenido on-chain para mostrar la consulta.

### 6. Resultado
- Consulta por identificador de paciente: **CUMPLIDO**.
- Filtrado por permisos vigentes: **CUMPLIDO**.
- Presentación estructurada del resumen clínico: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/EpisodiosPage.tsx` y `frontend/src/pages/PacientesPage.tsx`.
