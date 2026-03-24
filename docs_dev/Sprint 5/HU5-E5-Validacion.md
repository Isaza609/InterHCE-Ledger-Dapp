## HU5-E5. Mostrar información clínica y trazabilidad en la DApp según rol

### 1. Objetivo
Presentar información clínica, continuidad e historial de trazabilidad de forma clara, ordenada y diferenciada según el rol autenticado.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU5-E5).
- Profesionales y administradores ven contenido clínico si tienen permiso documental.
- El auditor solo accede a trazabilidad e integridad, no al documento clínico off-chain.

### 3. Implementación validada
- Frontend:
  - `frontend/src/pages/EpisodiosPage.tsx`
  - `frontend/src/pages/PortalClinicoPage.tsx`
  - `frontend/src/pages/VerEpisodioPage.tsx`
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`
  - `frontend/src/app/router.tsx`
  - `frontend/src/shared/auth/capabilities.ts`
- Backend:
  - `backend/src/routes/episodes.ts`

### 4. Casos funcionales
1. La DApp muestra resumen clínico, integridad y continuidad en la vista del episodio.
2. La trazabilidad se presenta como timeline verificable con filtros.
3. El rol auditor conserva acceso a auditoría sin exposición del documento.

### 5. Casos de validación
1. Ruta de documento protegida por capacidad y permiso documental.
2. Ruta de trazabilidad protegida por capacidad específica de auditoría.
3. Las pantallas mantienen solo visualización sobre la información histórica.

### 6. Resultado
- Presentación estructurada de información clínica y trazabilidad: **CUMPLIDO**.
- Filtrado y navegación según rol: **CUMPLIDO**.
- Protección del contenido histórico y sensible: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd frontend && npm run build`.
- UI: `frontend/src/pages/VerEpisodioPage.tsx`, `frontend/src/pages/TrazabilidadEpisodioPage.tsx` y `frontend/src/pages/PortalClinicoPage.tsx`.
