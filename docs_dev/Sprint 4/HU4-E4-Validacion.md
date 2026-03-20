## HU4-E4. Verificar la integridad de los documentos clínicos mediante hashes

### 1. Objetivo
Comprobar que el documento clínico almacenado off-chain coincide con el hash trazado para el episodio.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU4-E4).
- La evidencia de validación debe ser útil para auditoría e investigación de inconsistencias.

### 3. Implementación validada
- `backend/src/hce/documentoClinicoService.ts`
- `backend/src/hce/trazabilidadService.ts`
- `backend/src/routes/episodes.ts`
- `frontend/src/pages/TrazabilidadEpisodioPage.tsx`

### 4. Casos funcionales
1. Usuario autorizado obtiene resultado `Íntegro` o `Inconsistente`.
2. La verificación compara el hash actual del documento con el último hash trazado.
3. La evidencia devuelta incluye `sourceTraceId` y `sourceTransactionHash`.

### 5. Casos de validación
1. El cálculo del hash usa serialización canónica.
2. Sin permisos válidos no se permite la verificación.
3. La verificación no expone contenido clínico en la traza.

### 6. Resultado
- Verificación en cualquier momento: **CUMPLIDO**.
- Comparación hash on-chain / off-chain: **CUMPLIDO**.
- Evidencia reutilizable sin datos sensibles: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.

