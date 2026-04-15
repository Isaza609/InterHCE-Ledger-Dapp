# TX Demo Panel — DEMO_FLOW.md

Documento técnico del **TX Demo Panel** de InterHCE Ledger. Explica cada operación,
cada campo del panel de resultados y cómo la complejidad blockchain queda transparente
para el usuario final.

---

## Cómo activar el modo demo

1. Crear (o editar) `frontend/.env.local`:

   ```env
   VITE_DEMO_MODE=true
   VITE_API_BASE_URL=http://localhost:3001
   VITE_CHAIN_ID=11155111
   VITE_TRACE_CONTRACT_ADDRESS=0xTU_CONTRATO_SEPOLIA
   VITE_BLOCKCHAIN_EXPLORER_TX_BASE=https://sepolia.etherscan.io/tx/
   ```

2. Iniciar el backend y el frontend:

   ```bash
   # Terminal 1
   cd backend && npm run dev

   # Terminal 2
   cd frontend && npm run dev
   ```

3. Abrir el navegador en `http://localhost:5173`, **iniciar sesión** con cualquier
   usuario que tenga capacidad `episodios.crear` (por ejemplo, un `profesional_salud`
   o `super_admin`).

4. Navegar a `http://localhost:5173/demo`.

> Si `VITE_DEMO_MODE` no está definido o su valor no es exactamente `"true"`, la ruta
> `/demo` no existe en el router y el panel queda completamente inaccesible.

---

## Operaciones disponibles

### [1] Crear Episodio Clínico
**Endpoint:** `POST /episodes`  
**Tipo:** Escritura — consume gas en Sepolia.

Envía un payload FHIR-like con datos ficticios pero estructuralmente válidos
(paciente demo `DEMO-TX-99000001`, diagnóstico J06.9, IPS-003). El backend:

1. Valida el documento contra el schema Zod.
2. Genera un hash SHA-256 del documento.
3. Llama al smart contract `InterHCELedger.registrarEpisodio()` en Sepolia,
   emitiendo una transacción con el hash del documento y del episodio.
4. Persiste el episodio en el almacén off-chain (JSON + HAPI FHIR).
5. Devuelve `episodeId`, `documentHash`, `traceEvent` con evidencia blockchain.

El `episodeId` devuelto se guarda en el estado del panel para usarlo en las
operaciones 2 y 3.

---

### [2] Registrar Evento de Trazabilidad
**Endpoint:** `GET /episodes/:id/document`  
**Tipo:** Escritura — consume gas en Sepolia.

Accede al documento clínico completo del episodio. El backend:

1. Verifica que el actor autenticado tiene permisos de acceso.
2. **Registra automáticamente** un evento `AUDITABLE_ACCESS` en el smart contract
   `InterHCELedger.registrarTraza()`, emitiendo una nueva transacción.
3. Devuelve el documento clínico más `auditTrace` con la evidencia de la TX.

Aunque parece una lectura para el usuario ("ver documento"), en blockchain es una
escritura: cada acceso auditado queda sellado en cadena con el actor, timestamp y
metadata.

---

### [3] Consultar Historial de Episodio
**Endpoint:** `GET /episodes/:id/traceability`  
**Tipo:** Solo lectura — **sin costo de gas**.

Recupera todos los eventos de trazabilidad registrados para el episodio:
versiones, permisos activos, estados de permisos y la lista completa de
`traceEvents` con sus TX hashes.

Esta operación no emite ninguna transacción. Solo consulta el almacén off-chain
(`backend/data/trazabilidad-eventos.json`) y devuelve el historial completo.
Por eso el badge es **azul** ("Solo Lectura · sin gas").

---

## Campos del panel de resultado

| Campo | Significado | Aplica a |
|---|---|---|
| **TX Hash** | Identificador único de la transacción en Sepolia. 64 caracteres hex con prefijo `0x`. Inmutable una vez confirmada. | Ops 1 y 2 |
| **Bloque** | Número del bloque de Sepolia donde quedó incluida la TX. Cada bloque cierra cada ~12 segundos. | Ops 1 y 2 |
| **Gas Usado** | Unidades de cómputo consumidas al ejecutar la función del smart contract. Se expresa en wei y en Gwei/gas para contexto. | Ops 1 y 2 |
| **Confirmación** | Tiempo en milisegundos desde que se envió la TX hasta que se incluyó en un bloque. En testnet Sepolia oscila entre 700 ms y 1,5 s. | Ops 1 y 2 |
| **Timestamp** | Fecha y hora de confirmación de la TX según el nodo RPC, en hora local (es-CO). | Ops 1 y 2 |
| **Red** | Red Ethereum donde se ejecutó la transacción. Siempre `sepolia` en este prototipo. | Todas |
| **Ledger Mode** | `real` = TX enviada a Sepolia con wallet real; `simulado` = métricas estimadas sin TX real (BLOCKCHAIN_TRACE_MODE=mock). | Ops 1 y 2 |
| **Episode ID** | UUID del episodio clínico generado por el backend. Sirve de clave para todas las operaciones posteriores. | Todas |
| **Document Hash** | SHA-256 del payload FHIR completo del episodio. Es el valor sellado on-chain para verificación de integridad. | Ops 1 y 2 |
| **Eventos de Traza** | Total de eventos blockchain registrados para este episodio (CREATED, UPDATED, AUDITABLE_ACCESS, etc.). | Op 3 |
| **Versiones** | Número de versiones del documento clínico (se incrementa con cada PUT /episodes/:id). | Op 3 |
| **Permisos Activos** | IPSs que tienen acceso activo al episodio via grant de permisos. | Op 3 |

---

## Badges de estado

| Color | Estado | Significado |
|---|---|---|
| 🟢 Verde | Escritura Confirmada | La TX fue incluida en un bloque de Sepolia. El evento es inmutable. |
| 🔵 Azul | Solo Lectura · sin gas | La operación consultó datos sin emitir ninguna transacción. |
| 🟡 Amarillo | Pendiente | La TX fue enviada pero aún no se recibió confirmación, o hubo un error parcial. |

---

## Por qué las lecturas no gastan gas

En Ethereum, las transacciones (`transactions`) modifican el estado de la cadena y
requieren que el remitente pague gas (ether) al validador. Las llamadas de solo lectura
(`call`) consultan el estado actual sin modificarlo y se resuelven localmente en el
nodo RPC, sin necesidad de firmar ni pagar.

La operación 3 (`GET /episodes/:id/traceability`) recupera datos del almacén off-chain
(`backend/data/trazabilidad-eventos.json`) y del nodo RPC en modo lectura. Nunca
invoca una función `write` del contrato, por lo que no genera TX, no hay txHash y
el costo de gas es exactamente cero.

La operación 2 (`GET /episodes/:id/document`), aunque se inicia como una lectura HTTP,
**sí escribe en cadena**: el backend registra el acceso como `AUDITABLE_ACCESS` para
garantizar la trazabilidad de quién y cuándo vio el documento. Este evento on-chain
es el que genera una TX, consume gas y devuelve un txHash.

---

## Cómo la complejidad blockchain queda oculta al usuario final

El flujo clínico de InterHCE Ledger oculta deliberadamente la mecánica blockchain:

1. **El profesional de salud solo hace clic en "Registrar episodio"** en el formulario
   `CrearEpisodioPage`. No ve wallets, gas, ni transacciones.

2. **El backend actúa como firmante delegado**: posee la `DEPLOYER_PRIVATE_KEY` y
   usa el signer de ethers.js para enviar todas las TX en nombre del sistema,
   sin que el usuario deba instalar MetaMask ni manejar claves.

3. **La confirmación es asíncrona pero transparente**: el backend espera a que la TX
   sea minada (`await tx.wait()`) antes de responder al frontend. El usuario ve una
   respuesta exitosa; internamente ya hubo confirmación en Sepolia.

4. **El hash del documento es el nexo de integridad**: el usuario ve un `documentHash`
   SHA-256 que puede verificar independientemente. La cadena lo garantiza sin que el
   usuario interactúe con ella.

5. **El TX Demo Panel expone esta capa oculta** a propósito: su diseño oscuro tipo
   terminal contrasta con la UI clínica blanca para dejar claro que se está mostrando
   información técnica que normalmente no es visible.

---

## Removibilidad

Para eliminar el TX Demo Panel sin afectar el sistema:

1. Borrar la carpeta `frontend/src/demo/`.
2. En `frontend/src/app/router.tsx`, eliminar:
   - La línea `import { DemoPage } from "@/demo/DemoPage";`
   - El bloque `{import.meta.env.VITE_DEMO_MODE === "true" && (<Route path="/demo" ... />)}`
3. Eliminar `VITE_DEMO_MODE` de los archivos `.env`.

El resto del sistema —rutas, componentes, servicios, contratos— queda intacto.
