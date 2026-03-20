## HU2-E5. Implementar la DApp como interfaz de interaccion con el sistema

### 1. Objetivo
Consolidar una interfaz integrada tipo portal hospitalario para operar episodios, control de acceso, documentos off-chain y trazabilidad on-chain.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU2-E5).
- Requisitos: RF9, RF10, RNF8.
- Arquitectura: separacion on-chain/off-chain mantenida.

### 3. Implementacion validada
- Layout y navegacion integrada:
  - `frontend/src/components/layout/Layout.tsx`
  - `frontend/src/index.css`
- Portal funcional integrado (no pantalla por HU):
  - `frontend/src/pages/PortalClinicoPage.tsx`
- Integraciones:
  - Off-chain API: `frontend/src/shared/services/api.ts`
  - Blockchain testnet: `frontend/src/shared/services/blockchain.ts`

### 4. Casos funcionales
1. Usuario autenticado visualiza modulos segun rol (capacidades).
2. Admin gestiona usuarios desde el portal.
3. Profesional consulta documento permitido y registra traza en testnet.

### 5. Casos de validacion
1. Rol sin capacidad -> acciones ocultas/deshabilitadas.
2. Error de backend -> mensajes claros en tarjetas del portal.
3. Wallet ausente o red incorrecta -> mensaje guiado al usuario.

### 6. Resultado
- DApp integrada con backend y blockchain: **CUMPLIDO**.
- Interfaz clara, modular y orientada a flujo clinico: **CUMPLIDO**.
- Manejo de errores y estados operativos: **CUMPLIDO**.

### 7. Evidencia
- Build frontend: `cd frontend && npm run build`.
- Flujo on-chain verificable en explorer con tx hash retornado por el portal.
