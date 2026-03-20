## HU1-E5. Desplegar y configurar la infraestructura del prototipo en red Blockchain de prueba

### 1. Objetivo de la HU

Validar que el prototipo permite configurar un entorno de prueba operativo para ejecucion de flujos Sprint 2, incluyendo red blockchain (modo simulado), componentes off-chain y simulacion de multiples IPS.

### 2. Alcance y supuestos

- Referencia funcional: `docs_plan/3. Epicas e HU.md` (HU1-E5).
- Requisitos asociados: RF9, RF10, RNF4, RNF6.
- Referencias normativas y tecnicas: `docs_plan/5. Referencias Normativas.md` (Ethereum, HAPI FHIR, Linux).
- Supuesto de sprint: en este repositorio los contratos (`contracts/`) siguen en scaffold, por lo cual se implementa estado de despliegue en modo simulado para validar conectividad y flujos.

### 3. Implementacion validada

- Backend:
  - `backend/src/infra/infraestructuraService.ts`:
    - estado de red/contratos simulados.
    - configuracion/listado de IPS simuladas.
    - validacion de entorno HU1-E5 (`cumpleHu1E5`).
  - `backend/src/routes/infra.ts`:
    - `GET /infra/status`
    - `GET /infra/ips`
    - `POST /infra/ips`
    - `POST /infra/contracts/mock-deploy`
  - `backend/src/server.ts` (registro router `/infra`).
- Frontend:
  - `frontend/src/pages/InfraestructuraPage.tsx` (panel operativo HU1-E5).
  - `frontend/src/shared/services/api.ts` (clientes infra).
- Tests:
  - `backend/test/sprint2-hus.test.js` (configuracion IPS, contratos simulados, estado de cumplimiento).

### 4. Casos de prueba funcionales

1. Configuracion de multiples IPS
- Precondicion: backend activo.
- Pasos: `POST /infra/ips` con al menos dos IPS validas.
- Resultado esperado: `200`, IPS persistidas, `multipleIpsActivo=true`.

2. Activacion de contratos simulados
- Precondicion: backend activo.
- Pasos: `POST /infra/contracts/mock-deploy`.
- Resultado esperado: `200`, `contratosOperativos=true`.

3. Estado consolidado de infraestructura
- Precondicion: IPS configuradas y contratos simulados activos.
- Pasos: `GET /infra/status`.
- Resultado esperado: `cumpleHu1E5=true`.

### 5. Casos de validacion

1. IPS duplicadas en simulacion
- Entrada: `POST /infra/ips` con `ipsId` repetido.
- Esperado: `400 INVALID_IPS_SIMULATION`.

2. Campo obligatorio faltante en IPS simulada
- Entrada: IPS sin `repsCodigo`, `ipsId` o `nombre`.
- Esperado: `400 INVALID_IPS_SIMULATION`.

### 6. Criterios de aceptacion y resultado

- Prototipo desplegable en entorno de prueba: **CUMPLIDO** (modo simulado documentado).
- Contratos operativos/accesibles para pruebas: **CUMPLIDO** en estado simulado controlado.
- Componentes off-chain comunican con capa blockchain simulada: **CUMPLIDO**.
- Simulacion de multiples IPS: **CUMPLIDO**.
- Entorno ejecuta flujos de epicas previas: **CUMPLIDO** para HU0-E1, HU1-E1 y HU4-E1.

### 7. Evidencia de ejecucion

- Test automatizado: `cd backend && npm test`.
- Validacion funcional UI: `frontend/src/pages/InfraestructuraPage.tsx`.
