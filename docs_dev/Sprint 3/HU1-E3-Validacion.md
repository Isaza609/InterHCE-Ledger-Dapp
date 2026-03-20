## HU1-E3. Restringir acciones del sistema segun rol del usuario

### 1. Objetivo
Aplicar restricciones uniformes por rol en backend y en interfaz para impedir acciones no autorizadas.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU1-E3).
- Requisitos: RF6, RF9, RNF1.
- En UI, el portal integrado muestra/oculta acciones por capacidades del rol.

### 3. Implementacion validada
- Backend:
  - `backend/src/security/autorizacionService.ts`
  - `backend/src/access/accesoUsuariosService.ts`
  - `backend/src/routes/access.ts`
- Frontend:
  - `frontend/src/pages/PortalClinicoPage.tsx` (bloqueo de botones y mensajes de no autorizado).

### 4. Casos funcionales
1. `admin_ips` puede gestionar usuarios y permisos.
2. `profesional_salud` puede operar episodios y consultar documentos autorizados.

### 5. Casos de validacion
1. `paciente` intenta crear episodio -> bloqueado.
2. usuario inactivo intenta acceder a gestion -> bloqueado.
3. rol sin capacidad intenta ejecutar accion en portal -> boton deshabilitado + mensaje claro.

### 6. Resultado
- Restricciones por rol aplicadas en toda la capa backend: **CUMPLIDO**.
- Restricciones visibles y no evadibles desde interfaz estandar: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint3-hus.test.js` (caso HU1-E3 + HU5-E1).
