## HU3-E4. Registrar accesos auditables a episodios clínicos

### 1. Objetivo
Emitir evidencia trazable cada vez que se consulta un documento clínico que requiere auditoría.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU3-E4).
- El acceso auditable registra episodio, IPS origen, IPS que consulta y tipo de acceso.
- El evento no persiste contenido clínico ni datos personales en la traza.

### 3. Implementación validada
- Backend:
  - `backend/src/routes/episodes.ts` (`GET /episodes/:id/document`)
  - `backend/src/hce/trazabilidadService.ts`
- Frontend:
  - `frontend/src/pages/VerEpisodioPage.tsx`

### 4. Casos funcionales
1. Actor autorizado consulta documento off-chain y recibe `auditTrace`.
2. La evidencia del acceso queda asociada al episodio y a la IPS que consulta.
3. La DApp presenta la evidencia del acceso junto con el documento.

### 5. Casos de validación
1. Consulta sin permiso documental -> rechazo.
2. El evento `AUDITABLE_ACCESS` conserva `sourceIpsId`, `targetIpsId` y `accessType`.
3. La traza no contiene el payload clínico del documento.

### 6. Resultado
- Registro auditable por consulta documental: **CUMPLIDO**.
- Asociación a episodio e IPS de acceso: **CUMPLIDO**.
- Preservación de privacidad clínica en la traza: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/VerEpisodioPage.tsx`.
