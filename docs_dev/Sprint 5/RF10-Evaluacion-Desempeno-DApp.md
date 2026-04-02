# RF10 — Módulo de Evaluación de Desempeño de la DApp

## 1. Descripción general

El **RF10 – Registro de auditoría para evaluación** corresponde al **tercer objetivo del proyecto**: evaluar el desempeño de la DApp en términos de interoperabilidad, eficiencia y seguridad. El módulo es accesible exclusivamente desde el rol de usuario **auditor**.

La evaluación se divide en dos capas complementarias:

| Capa | Dónde vive | Qué mide |
|---|---|---|
| **Sección A — Pruebas de estrés de red** | `GET /audit/metrics`, `POST /audit/run` | Rendimiento de la red blockchain: TPS, latencia, gas, seguridad, ERC deploy |
| **Sección B — Interoperabilidad clínica (HU0-HU5)** | `GET /evaluation/dashboard` | Episodios entre IPS, continuidad asistencial, integridad, tiempos de acceso off-chain |

Ambas secciones viven en una sola página (`/auditoria/metricas`) organizada con encabezados que explican claramente qué mide cada una.

---

## 2. Arquitectura del módulo RF10

```
frontend/src/pages/AuditoriaDashboardPage.tsx  ←  rol auditor
        │
        │ HTTP  GET  /audit/metrics
        │       GET  /audit/metrics/:id
        │       POST /audit/run
        ▼
backend/src/routes/audit.ts
        │
        ├─► backend/src/audit/auditMetricsService.ts   ← lógica de negocio
        │         │
        │         ├─► pandorasBoxAdapter.ts             ← ejecuta pandoras-box CLI
        │         │         ├─► ejecución real           (si hay mnemonic con fondos)
        │         │         └─► simulación realista      (fallback vía JSON-RPC)
        │         │
        │         └─► shared/jsonFileStore.ts           ← persistencia
        │                   └─► backend/data/audit-metrics.json
        │
        └─► backend/src/audit/auditMetricModel.ts      ← tipos TypeScript
```

---

## 3. ¿Qué es pandoras-box?

**pandoras-box** ([github.com/sig-0/pandoras-box](https://github.com/sig-0/pandoras-box)) es una herramienta CLI de stress-testing para redes compatibles con Ethereum (EVM). Fue creada para que los desarrolladores de clientes Ethereum puedan medir el rendimiento de un nodo bajo carga real.

### ¿Cómo funciona por dentro?

pandoras-box genera un conjunto de **cuentas (subcuentas)** a partir de un mnemonic BIP-39, las financia desde la cuenta principal (índice 0 del mnemonic), y luego envía transacciones en paralelo desde esas subcuentas. Al terminar, recopila los recibos de las transacciones, consulta los bloques donde quedaron incluidas, y calcula el TPS promedio y los datos por bloque.

### Comando real que ejecuta el adaptador

```bash
pandoras-box \
  -url  "https://eth-sepolia.g.alchemy.com/v2/<API_KEY>" \
  -m    "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12" \
  -t    100          \   # total transacciones
  -s    5            \   # subcuentas
  --mode EOA         \   # EOA | ERC20 | ERC721
  -b    10           \   # tamaño de lote JSON-RPC (reducido para Alchemy)
  -o    /tmp/pandoras-XXXX/result.json
```

> **Nota importante:** Los flags son `-url`, `-m`, `-t`, `-s`, `-b` y `-o`. No usan prefijo `--` (excepto `--mode`). El resultado se escribe en un **archivo JSON en disco**, no en stdout.

### Formato JSON de salida de pandoras-box

```json
{
  "averageTPS": 8,
  "blocks": [
    {
      "blockNum": 7924130,
      "createdAt": 1718000100,
      "numTxs": 12,
      "gasUsed":  "0x52080",
      "gasLimit": "0x1C9C380",
      "gasUtilization": 1.17
    },
    {
      "blockNum": 7924131,
      "createdAt": 1718000112,
      "numTxs": 15,
      "gasUsed":  "0x67A80",
      "gasLimit": "0x1C9C380",
      "gasUtilization": 1.47
    }
  ]
}
```

Lo que pandoras-box **sí entrega directamente**:
- `averageTPS` — TPS calculado sobre todas las transacciones confirmadas
- Por cada bloque: número, timestamp Unix, cantidad de tx, gas usado (hex), gas límite (hex), utilización (%)

Lo que pandoras-box **no entrega** (el adaptador lo deriva):
- Latencia de confirmación — no existe un campo explícito; se estima como `blocktime × 1.15`
- Transacciones fallidas — se infieren como `totalTransacciones - txEnBloques`
- Reverts y out-of-gas — no quedan registrados en el output; se estiman del total de fallos
- TPS pico — se calcula como `max(tx_bloque / blocktime)` sobre todos los bloques

---

## 4. Diferencias entre ejecución real (pandoras-box) y simulación

Esta es la distinción más importante para interpretar los resultados.

### 4.1 Ejecución real con pandoras-box

| Característica | Valor |
|---|---|
| Campo `fuente` | `"pandoras-box"` |
| Indicador en UI | 🔴 Ejecución real con pandoras-box |
| TPS | Real: se mide sobre transacciones confirmadas en la red |
| Gas | Real: valores hex del bloque tal como los reporta el nodo |
| Blocktime | Real: diferencia de timestamps entre bloques consecutivos observados |
| Transacciones fallidas | Real: tx enviadas que no llegaron a bloque en el plazo |
| Latencia | **Estimada** incluso en ejecución real (pandoras-box no mide el timestamp de envío individual) |
| Reverts / out-of-gas | **Estimados** por proporción del total de fallos |

**Cuándo se activa:** cuando se proporciona un mnemonic con fondos suficientes en la red objetivo.

### 4.2 Simulación realista (fallback)

| Característica | Valor |
|---|---|
| Campo `fuente` | `"simulacion"` |
| Indicador en UI | 🔵 Simulación (datos del nodo RPC) |
| Base de datos | Consulta real al nodo: últimos 10 bloques vía `eth_getBlockByNumber` |
| TPS | Sintético, calibrado según el `chainId` de la red |
| Gas | Sintético, basado en promedios conocidos por modo (EOA/ERC20/ERC721) |
| Variabilidad | Distribución normal con semilla aleatoria — cada ejecución da resultados ligeramente distintos |
| Blocktime | Tomado de los bloques reales consultados (si el nodo responde) |

**Cuándo se activa:**
- No se proporcionó mnemonic
- pandoras-box no está instalado (`ENOENT`)
- pandoras-box falló durante la ejecución (fondos insuficientes, RPC caído, etc.)

### 4.3 Comparación de precisión

| Métrica | Real (pandoras-box) | Simulación |
|---|---|---|
| TPS promedio | ✅ Medido | ⚠️ Estimado |
| Blocktime | ✅ Medido | ✅ Del nodo real |
| Gas por bloque | ✅ Del bloque real | ⚠️ Estimado por modo |
| Latencia confirmación | ⚠️ Estimada (no hay timestamp individual) | ⚠️ Estimada |
| Fallos/reverts | ⚠️ Parcial (no hay desglose en pandoras-box) | ⚠️ Estimado por porcentaje |
| chainId / rpcUrl | ✅ Red real probada | ✅ Red real consultada |

---

## 5. Por qué sigue saliendo "simulación" aunque se ingrese el mnemonic

Este es el problema más frecuente. Hay cuatro causas posibles, en orden de probabilidad:

### Causa 1 — La cuenta del mnemonic no tiene fondos (la más común)

pandoras-box necesita que la **primera dirección** del mnemonic tenga ETH suficiente para:
1. Distribuir ETH a cada subcuenta
2. Pagar gas de todas las transacciones

Si la cuenta no tiene fondos, pandoras-box falla internamente y el adaptador cae a simulación.

**Cómo verificarlo:**
1. Obtener la primera dirección del mnemonic:
   ```bash
   node -e "
   const { ethers } = require('ethers');
   const w = ethers.Wallet.fromPhrase('palabra1 palabra2 ...');
   console.log('Dirección:', w.address);
   "
   ```
2. Buscar esa dirección en [sepolia.etherscan.io](https://sepolia.etherscan.io) y verificar que tiene ETH.
3. Si no tiene, usar el faucet: [sepoliafaucet.com](https://sepoliafaucet.com) o [faucet.quicknode.com](https://faucet.quicknode.com/ethereum/sepolia).

**Cantidad recomendada:** al menos 0.05 ETH para una prueba de 100 tx con 5 subcuentas en Sepolia.

---

### Causa 2 — El mensaje de error de pandoras-box no llega al adaptador

Hasta la corrección de este sprint, el `catch` del adaptador solo re-lanzaba errores con palabras clave específicas (`insufficient`, `nonce`, `network`, `connection`). Cualquier otro mensaje de error de pandoras-box se ignoraba silenciosamente y se caía a simulación sin explicación.

**Solución aplicada:** ahora el adaptador captura el `stderr` completo del proceso hijo y lo devuelve como campo `advertencia` en la respuesta. El frontend lo muestra con un banner de aviso amarillo después de ejecutar la prueba, con el mensaje exacto de pandoras-box.

---

### Causa 3 — pandoras-box no está en el PATH del proceso Node.js del backend

El binario está instalado en:
```
/home/aisaza/.nvm/versions/node/v18.20.8/bin/pandoras-box
```

Cuando el backend corre con `npm run dev` desde la terminal interactiva, el PATH incluye la ruta de nvm y `pandoras-box` se encuentra. Pero si el backend se inicia de otra forma (pm2, systemd, script sin `.bashrc`), el PATH puede no incluir el directorio de nvm.

**Solución aplicada:** el adaptador busca el binario en múltiples rutas conocidas antes de llamar a `execFile`. También acepta la ruta absoluta como fallback automático.

**Para confirmar que el backend lo ve:**
```bash
# Ejecutar desde el mismo proceso/entorno donde corre el backend
node -e "const { execSync } = require('child_process'); console.log(execSync('which pandoras-box').toString());"
```

---

### Causa 4 — La URL del nodo RPC es incorrecta o el nodo no responde

pandoras-box necesita conectarse al nodo para enviar transacciones. Si la URL de Alchemy/Infura/otro proveedor es incorrecta o el nodo está caído, pandoras-box falla.

**Verificación rápida:**
```bash
curl -X POST https://eth-sepolia.g.alchemy.com/v2/<API_KEY> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```
Debe responder con `{"result":"0x..."}`.

---

### Cómo ver el error exacto de pandoras-box desde la UI

A partir de la corrección de este sprint, cuando pandoras-box falla:
1. La prueba **sí termina** (con fuente `simulacion`)
2. Aparece un banner amarillo en la UI con el texto: **"⚠️ pandoras-box no pudo ejecutarse → se usó simulación. Detalle: [mensaje exacto]"**

Esto permite diagnoticar la causa sin tener que revisar los logs del backend.

---

## 6. Métricas evaluadas

### 6.1 Throughput — Eje de Eficiencia

| Métrica | Descripción | Campo JSON |
|---|---|---|
| **TPS promedio** | Transacciones confirmadas por segundo durante toda la prueba | `tpsPromedio` |
| **TPS pico** | Máximo TPS observado en cualquier bloque individual | `tpsPico` |
| **Total transacciones** | Volumen total enviado al nodo | `totalTransacciones` |
| **Transacciones exitosas** | Confirmadas en bloque sin error | `transaccionesExitosas` |
| **Transacciones fallidas** | No confirmadas (revert + out-of-gas + otros) | `transaccionesFallidas` |

**Fórmulas:**
```
TPS promedio = totalTransacciones / duraciónPrueba (s)
TPS pico     = máximo de (tx_bloque / blocktime_seg) sobre todos los bloques
```

---

### 6.2 Latencia de transacción — Eje de Eficiencia

Tiempo desde que la transacción es enviada hasta que queda incluida en un bloque.

| Métrica | Descripción | Campo JSON |
|---|---|---|
| **Latencia promedio** | Media aritmética sobre todas las tx exitosas | `latenciaPromedioMs` |
| **Latencia mínima** | Transacción confirmada más rápido | `latenciaMinMs` |
| **Latencia máxima** | Transacción confirmada más lento | `latenciaMaxMs` |
| **P95** | El 95 % de las transacciones se confirman en ≤ este tiempo | `latenciaP95Ms` |

> **Nota sobre precisión:** pandoras-box no registra el timestamp exacto de envío de cada transacción. La latencia se estima como `blocktime × 1.15`, lo que representa la cota inferior realista (una tx enviada al comienzo de un bloque espera al menos un bloque completo). En redes con blocktimes largos como Sepolia (~12 s), la latencia real es de 12–36 s dependiendo del momento del envío.

---

### 6.3 Tiempo de bloque (blocktime) — Eje de Eficiencia

| Métrica | Descripción | Campo JSON |
|---|---|---|
| **Blocktime promedio** | Media de la diferencia de timestamps entre bloques consecutivos | `blockTimePromedioSeg` |
| **Bloques observados** | Cantidad de bloques en la ventana de la prueba | `bloquesObservados` |

El blocktime condiciona la latencia mínima:

| Red | Blocktime típico | Latencia mínima aprox. |
|---|---|---|
| Ethereum Mainnet / Sepolia | 12 s | ~12–36 s |
| Polygon | 2.2 s | ~2–6 s |
| Arbitrum (L2) | 0.25 s | ~0.3–1 s |
| Hardhat local | <1 s (minado instantáneo) | ~100 ms |

---

### 6.4 Gas — Eje de Eficiencia

| Métrica | Descripción | Campo JSON |
|---|---|---|
| **Gas usado promedio** | Unidades de gas consumidas por transacción exitosa (promedio) | `gasUsadoPromedio` |
| **Gas usado máximo** | Máximo observado en una sola transacción | `gasUsadoMax` |
| **Gas limit** | Límite de gas por bloque en la red | `gasLimit` |
| **Utilización de gas (%)** | `(tx exitosas × gasUsadoPromedio) / (gasLimit × bloques)` | `gasUtilizacionPct` |

**Referencia por modo:**

| Modo | Gas típico/tx |
|---|---|
| EOA (transferencia ETH) | ≈ 21 000 (fijo) |
| ERC20 (`transfer`) | ≈ 50 000 |
| ERC721 (`mint`) | ≈ 120 000 |

---

### 6.5 Seguridad — Eje de Seguridad

| Métrica | Descripción | Campo JSON |
|---|---|---|
| **Tasa de éxito (%)** | `transaccionesExitosas / totalTransacciones × 100` | `tasaExito` |
| **Transacciones revertidas** | Ejecutadas pero cuya ejecución fue revertida (`revert`) | `transaccionesRevertidas` |
| **Transacciones out-of-gas** | Fallaron porque agotaron el gas asignado | `transaccionesOutOfGas` |
| **Tiempo de respuesta del nodo** | Latencia promedio de llamadas JSON-RPC bajo carga (ms) | `tiempoRespuestaNodoMs` |

Una **tasa de éxito ≥ 95 %** es el umbral verde por defecto. Por debajo del 80 % se considera crítico, indicando saturación del nodo o errores de configuración.

---

### 6.6 Interoperabilidad blockchain — Eje de Interoperabilidad

Aplica solo a los modos **ERC20** y **ERC721** (en EOA no hay contrato).

| Métrica | Descripción | Campo JSON |
|---|---|---|
| **Deploy exitoso** | Si el contrato fue desplegado correctamente | `deployExitoso` |
| **Llamadas ERC exitosas** | Funciones del contrato ejecutadas correctamente | `llamadasERCExitosas` |
| **Llamadas ERC total** | Total de llamadas intentadas | `llamadasERCTotal` |
| **Red evaluada (chainId)** | Identificador numérico de la red | `chainId` |
| **URL RPC usada** | Endpoint del nodo evaluado | `rpcUrl` |

---

### 6.7 Series temporales por bloque

Para cada bloque observado durante la prueba se registra:

| Campo | Descripción |
|---|---|
| `block_number` | Número del bloque |
| `timestamp` | Fecha/hora ISO del bloque |
| `tx_count` | Transacciones en ese bloque |
| `gas_used` | Gas consumido en ese bloque |
| `gas_limit` | Límite de gas del bloque |
| `block_time_seconds` | Tiempo transcurrido desde el bloque anterior |
| `tps` | `tx_count / block_time_seconds` |

Estos datos alimentan las **mini-gráficas SVG** del panel de detalle.

---

## 7. Modos de prueba

pandoras-box soporta tres modos seleccionables desde el formulario:

### Modo EOA
Genera transferencias ETH directas entre externally-owned accounts. No requiere contrato previo.
- **Gas/tx:** ≈ 21 000 (fijo para transferencias ETH).
- **Cuándo usarlo:** prueba base de capacidad del nodo sin lógica de contrato.
- **Interoperabilidad:** N/A (sin contrato).

### Modo ERC20
Despliega automáticamente un contrato ERC20 (`ZexCoin`) y ejecuta llamadas `transfer()`.
- **Gas/tx:** ≈ 50 000.
- **Cuándo usarlo:** mide la sobrecarga de contratos fungibles sobre el nodo.
- **Interoperabilidad:** semáforo verde si deploy OK y tasa de llamadas ≥ 95 %.

### Modo ERC721
Despliega un contrato ERC721 (`ZexNFTs`) y ejecuta mint de NFTs.
- **Gas/tx:** ≈ 120 000 o más.
- **Cuándo usarlo:** el modo más costoso; representa contratos complejos.
- **Interoperabilidad:** el más exigente de los tres.

---

## 8. Indicadores semáforo

Cada evaluación calcula cuatro semáforos automáticamente. Los umbrales son configurables por prueba desde el formulario (sección "Opciones avanzadas").

### 8.1 Eficiencia (TPS)

| Estado | Condición (defaults) | Significado |
|---|---|---|
| 🟢 Verde | `tpsPromedio ≥ 10` | Red con capacidad adecuada para la carga |
| 🟡 Amarillo | `tpsPromedio ≥ 5` | Capacidad aceptable, posible cuello de botella |
| 🔴 Rojo | `tpsPromedio < 5` | Red saturada o nodo con problemas |

### 8.2 Latencia de confirmación

| Estado | Condición (defaults) | Significado |
|---|---|---|
| 🟢 Verde | `latenciaPromedioMs ≤ 30 000` | Contexto hospitalario óptimo (~2 bloques EVM) |
| 🟡 Amarillo | `latenciaPromedioMs ≤ 60 000` | Aceptable para red hospitalaria |
| 🔴 Rojo | `latenciaPromedioMs > 60 000` | Más de 60 s; congestión o retrasos severos |

> **Ajuste hospitalario:** además del criterio blockchain, el director del proyecto definió umbrales más amplios para una red hospitalaria. Por eso, desde este ajuste se considera óptimo confirmar en ≤ 30 s (~2 bloques EVM), aceptable en ≤ 60 s y crítico por encima de 60 s.

Los umbrales son configurables por prueba desde "Opciones avanzadas" del formulario (`umbralLatenciaVerdeMs`, `umbralLatenciaAmarilloMs`).

### 8.3 Seguridad (tasa de éxito)

| Estado | Condición | Significado |
|---|---|---|
| 🟢 Verde | `tasaExito ≥ 95 %` | El nodo procesa la carga sin errores significativos |
| 🟡 Amarillo | `tasaExito ≥ 80 %` | Nivel de fallos aceptable en estrés |
| 🔴 Rojo | `tasaExito < 80 %` | Alta tasa de reverts o out-of-gas |

### 8.4 Interoperabilidad EVM / HCE

El semáforo ahora evalúa cuatro condiciones concretas en lugar del criterio binario anterior:

| Estado | Condición | Significado |
|---|---|---|
| 🟢 Verde | Nodo accesible + deploy OK + llamadas ERC ≥ 95 % | Contrato operable de forma confiable |
| 🟡 Amarillo | Nodo accesible pero sin contrato verificado (modo EOA, o ERC con 0 llamadas registradas) | Parcialmente verificado |
| 🔴 Rojo | Nodo no accesible, **o** deploy explícitamente fallido | Interoperabilidad bloqueada |

**Detalle por modo:**
- **EOA:** siempre 🟡 Amarillo. El nodo respondió, pero no hay contrato que evaluar. Se verifica que `eth_chainId` y `eth_blockNumber` respondan, y que las transferencias de valor se confirmen.
- **ERC20 / ERC721:** 🟢 si deploy exitoso + `llamadasERCExitosas / llamadasERCTotal ≥ 95 %`; 🟡 si deploy OK pero sin llamadas medidas o tasa 80–95 %; 🔴 si deploy falló o nodo no responde.

> **Cambio respecto al sprint anterior:** el modo EOA retornaba "verde" incondicionalmente (el nodo respondió = verdad trivial), lo que no aportaba información de evaluación. Ahora "amarillo" en EOA comunica explícitamente que la verificación de interoperabilidad con contratos ERC no fue realizada.

Cada registro también guarda el objeto `interoperabilityDetails`:

```jsonc
"interoperabilityDetails": {
  "chainId": 11155111,
  "rpcUrl": "https://rpc.sepolia.org",
  "nodoAccesible": true,
  "contratoAccesible": true,        // false en modo EOA
  "readCallsOk": true,
  "writeCallsOk": true,
  "compatibilidadERC": "ERC20 (contrato: 0x1234abcd…)",
  "nota": "Compatibilidad ERC20: deploy exitoso, llamadas ERC con tasa 97.0 %. Red: chain 11155111 · RPC: https://rpc.sepolia.org…"
}
```

---

## 9. Flujo de ejecución del adaptador (decisión pandoras-box vs simulación)

```
POST /audit/run recibe config
         │
         ▼
  ¿Hay mnemonic?
  ─────────────────────────────────────────────
  NO → Simulación directa (consulta nodo RPC)
  ─────────────────────────────────────────────
  SÍ → execFile("pandoras-box", [...flags], {env: process.env})
         │
         ├── ENOENT (no instalado)
         │     └→ Simulación (sin advertencia, no es error del usuario)
         │
         ├── Exit code ≠ 0 (pandoras-box falló)
         │     └→ Simulación + campo advertencia con stderr completo
         │
         ├── Terminó pero no escribió archivo JSON
         │     └→ Simulación + advertencia "sin archivo de salida"
         │
         └── Terminó y escribió archivo JSON
               └→ Parseo JSON → fuente: "pandoras-box" ✅
```

---

## 10. Relación con los ejes de evaluación del objetivo 3

| Eje | Métricas RF10 que lo miden | Semáforo |
|---|---|---|
| **Eficiencia** | TPS promedio, TPS pico, blocktime | Eficiencia |
| **Latencia** | Latencia promedio, P95, tiempo de respuesta del nodo | Latencia |
| **Seguridad** | Tasa de éxito, reverts, out-of-gas | Seguridad |
| **Interoperabilidad de red** | Deploy ERC, llamadas ERC exitosas, chainId, rpcUrl | Interoperabilidad |
| **Interoperabilidad clínica** | Episodios multi-IPS, continuidad, permisos, integridad | (Sección B — HU0-HU5) |

---

## 11. Persistencia de resultados

Cada evaluación se guarda en `backend/data/audit-metrics.json`:

```jsonc
{
  "id": "uuid-v4",
  "timestamp": "2025-10-15T14:30:00.000Z",
  "modo": "ERC20",
  "rpcUrl": "https://rpc.sepolia.org",
  "chainId": 11155111,
  "fuente": "pandoras-box",           // o "simulacion"
  "tpsPico": 14.2,
  "tpsPromedio": 8.6,
  "totalTransacciones": 200,
  "transaccionesExitosas": 194,
  "transaccionesFallidas": 6,
  "tasaExito": 97.0,
  "latenciaPromedioMs": 13800,
  "latenciaMinMs": 7200,
  "latenciaMaxMs": 28000,
  "latenciaP95Ms": 19500,
  "blockTimePromedioSeg": 12.1,
  "bloquesObservados": 8,
  "gasUsadoPromedio": 48920,
  "gasUsadoMax": 65000,
  "gasLimit": 30000000,
  "gasUtilizacionPct": 1.24,
  "transaccionesRevertidas": 4,
  "transaccionesOutOfGas": 2,
  "tiempoRespuestaNodoMs": 130,
  "sesionId": "sesion-uuid-v4",       // id de la sesión activa al momento de la prueba (nullable)
  "deployExitoso": true,
  "llamadasERCExitosas": 194,
  "llamadasERCTotal": 200,
  "interoperabilityDetails": {
    "chainId": 11155111,
    "rpcUrl": "https://rpc.sepolia.org",
    "nodoAccesible": true,
    "contratoAccesible": true,
    "readCallsOk": true,
    "writeCallsOk": true,
    "compatibilidadERC": "ERC20 (contrato: 0x1234abcd…)",
    "nota": "Compatibilidad ERC20: deploy exitoso, llamadas ERC con tasa 97.0 %..."
  },
  "semaforoEficiencia": "amarillo",
  "semaforoLatencia": "verde",       // ahora verde porque 13 800 ms ≤ 30 000 ms
  "semaforoSeguridad": "verde",
  "semaforoInteroperabilidad": "verde",
  "blockSamples": [ /* serie por bloque */ ],
  "rawOutput": { /* JSON completo de pandoras-box o simulación */ }
}
```

---

## 12. Endpoints REST

### GET /audit/metrics
**Requiere:** rol `auditor` o `super_admin`.
Lista histórica sin series de bloque (para reducir tamaño de respuesta).

**Query params opcionales:**
- `?sesionId=<id>` — filtra por sesión de evaluación.
- `?desde=<ISO>` — filtra registros con `timestamp >= desde`.

### GET /audit/metrics/:id
**Requiere:** rol `auditor` o `super_admin`.
Detalle completo incluyendo `blockSamples`, `rawOutput` e `interoperabilityDetails`.

### POST /audit/run
**Requiere:** rol `auditor` o `super_admin`.

```jsonc
{
  "rpcUrl": "https://eth-sepolia.g.alchemy.com/v2/<KEY>",
  "modo": "EOA",                 // "EOA" | "ERC20" | "ERC721"
  "totalTransacciones": 100,
  "numSubcuentas": 5,
  "mnemonic": "word1 … word12",  // opcional pero necesario para ejecución real
  "batchSize": 10,               // opcional, default 10 (reducido para Alchemy)
  "contractAddress": "0x...",    // opcional, solo ERC20/ERC721
  "umbralTpsVerde": 10,          // opcionales: umbrales de semáforos
  "umbralTpsAmarillo": 5,
  "umbralLatenciaVerdeMs": 30000,    // default: ≤ 30 s → óptimo hospitalario (~2 bloques EVM)
  "umbralLatenciaAmarilloMs": 60000, // default: ≤ 60 s → aceptable en red hospitalaria
  "umbralTasaExitoVerde": 95
}
```

**Respuesta exitosa (HTTP 201):**
```json
{
  "code": "OK",
  "message": "Evaluación completada · Ejecución directa con pandoras-box en Sepolia. ID: 3f8a...",
  "fuente": "pandoras-box",
  "advertencia": null,
  "data": { }
}
```

Cuando pandoras-box falla pero se usa simulación (con error):
```json
{
  "message": "Evaluación completada · Simulación con datos del nodo RPC (pandoras-box no pudo ejecutarse). ID: 3f8a...",
  "fuente": "simulacion",
  "advertencia": "[Ejecución directa con pandoras-box] Rate limit de Alchemy: las transacciones SÍ se enviaron a Sepolia pero pandoras-box no pudo recopilar todos los recibos antes del timeout interno de 30 s..."
}
```

Cuando no se proporciona mnemonic (simulación directa):
```json
{
  "message": "Evaluación completada · Simulación con datos del nodo RPC (sin mnemonic configurado). ID: 3f8a...",
  "fuente": "simulacion",
  "advertencia": null
}
```

---

### POST /audit/session/reset
**Requiere:** rol `auditor` o `super_admin`.
Inicia una nueva sesión de evaluación. Las métricas registradas a partir de este punto quedan asociadas al `sesionId` devuelto.

```jsonc
// Body (todos opcionales)
{
  "label": "Prueba carga alta — 500 tx",  // etiqueta libre
  "startBlockRef": 7924130                 // bloque de referencia inicial
}
```

**Respuesta (HTTP 201):**
```json
{
  "code": "OK",
  "message": "Nueva sesión de evaluación iniciada. Las métricas registradas a partir de ahora quedarán asociadas al ID 'sesion-uuid'.",
  "data": {
    "id": "sesion-uuid",
    "label": "Prueba carga alta — 500 tx",
    "startedAt": "2026-03-24T10:00:00.000Z",
    "startBlockRef": 7924130,
    "iniciadaPor": "usuario-uuid"
  }
}
```

### GET /audit/session/current
**Requiere:** rol `auditor` o `super_admin`.
Devuelve la sesión activa o `data: null` si no hay ninguna.

### GET /audit/session/list
**Requiere:** rol `auditor` o `super_admin`.
Lista todas las sesiones en orden cronológico.

**Persistencia:** `backend/data/evaluacion-sesion.json`.

---

## 13. Cómo ejecutar una prueba real con pandoras-box paso a paso

### Paso 1 — Verificar instalación

```bash
pandoras-box --help
# Debe mostrar: Usage: pandoras-box [options] ...
```

### Paso 2 — Obtener la dirección principal del mnemonic

```bash
node -e "
const { ethers } = require('ethers');
const mnemonic = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';
const w = ethers.Wallet.fromPhrase(mnemonic);
console.log('Dirección principal:', w.address);
"
```

### Paso 3 — Verificar y cargar fondos en Sepolia

1. Ir a [sepolia.etherscan.io](https://sepolia.etherscan.io) y pegar la dirección del paso 2.
2. Si el saldo es 0, usar el faucet: [sepoliafaucet.com](https://sepoliafaucet.com).
3. Recargar hasta tener **al menos 0.05 ETH** para una prueba de 100 tx / 5 subcuentas.

### Paso 4 — Ejecutar desde la DApp

1. Autenticarse como rol `auditor`.
2. Ir a la ruta `/auditoria/metricas`.
3. Pulsar **Nueva prueba** en la Sección A.
4. Ingresar la URL del nodo RPC (la misma de `contracts/.env`).
5. Seleccionar modo `EOA` para la prueba inicial (es la más económica en gas).
6. Ingresar el mnemonic en el campo correspondiente.
7. Pulsar **Ejecutar prueba**.
8. Si aparece un banner amarillo con advertencia, leerlo para identificar qué falló.
9. Si la prueba termina con `fuente: pandoras-box`, los datos son reales.

---

## 14. Implementación — archivos del módulo

### Backend

| Archivo | Responsabilidad |
|---|---|
| `backend/src/audit/auditMetricModel.ts` | Tipos TypeScript: `PandorasBoxOutput`, `AuditMetricRecord` (incl. `sesionId`, `interoperabilityDetails`), `AuditRunConfig`, `UMBRALES_DEFAULT` |
| `backend/src/audit/pandorasBoxAdapter.ts` | Ejecución real de pandoras-box + fallback simulación; búsqueda de archivo de salida en rutas alternativas (bug EOA); captura de stdout/stderr en errores |
| `backend/src/audit/auditMetricsService.ts` | Capa de servicio: `listarMetricas(opciones?)`, `obtenerMetricaPorId(id)`, `ejecutarEvaluacion(config)`, `buildInteroperabilityDetails()`, cálculo de semáforo de interoperabilidad con 5 parámetros |
| `backend/src/audit/evaluacionSesionService.ts` | Gestión de sesiones de evaluación: `iniciarNuevaSesion()`, `obtenerSesionActual()`, `listarSesiones()`, `obtenerSesionPorId()` |
| `backend/src/routes/audit.ts` | Router Express: 3 endpoints de métricas + 3 de sesión (reset/current/list) |
| `backend/src/server.ts` | Registro del router en `app.use("/audit", auditRouter)` |
| `backend/data/audit-metrics.json` | Persistencia de registros de evaluación (generado en runtime) |
| `backend/data/evaluacion-sesion.json` | Persistencia de sesiones de evaluación (generado en runtime) |
| `backend/scripts/seed-evaluacion-demo.ts` | Script de datos demo: pacientes con género alternado (M/F), 7 EPS colombianas, signos vitales por diagnóstico CIE-10 |

### Frontend

| Archivo | Responsabilidad |
|---|---|
| `frontend/src/pages/AuditoriaDashboardPage.tsx` | Página RF10: Sección A (estrés de red) + Sección B (interop. clínica); incluye `PanelSesion`, filtro por sesión, botón "Descargar informe PDF" en cada detalle expandido |
| `frontend/src/shared/services/api.ts` | Tipos e interfaces incl. `EvaluacionSesion`, `interoperabilityDetails?` en `AuditMetricResumen`; funciones `iniciarSesionEvaluacion()`, `obtenerSesionEvaluacion()`, `listarSesionesEvaluacion()` |
| `frontend/src/app/router.tsx` | Ruta `/auditoria/metricas` con guard `evaluacion.consultar` |

---

## 15. Sesiones de evaluación

Las sesiones permiten agrupar varias ejecuciones de prueba bajo un mismo contexto sin necesidad de borrar el historial de la blockchain (los registros son inmutables en `audit-metrics.json`).

### Concepto
Cuando el auditor pulsa **"Iniciar nueva sesión"**, el backend genera un `EvaluacionSesion` con un UUID y un `startedAt`. Toda métrica registrada a partir de ese momento recibe el campo `sesionId` apuntando a esa sesión.

### Filtrado en la UI
El componente `PanelSesion` muestra la sesión activa y ofrece dos modos de vista:
- **Todas:** muestra todo el historial.
- **Sesión actual:** filtra `lista` a registros con `sesionId === sesionActual.id`.

### Cuándo usar sesiones
- Antes de una demostración: iniciar sesión nueva para tener un historial limpio de esa jornada.
- Después de un cambio de configuración (nueva URL RPC, nuevo modo): separar resultados del experimento anterior.
- Para comparar dos configuraciones: una sesión por configuración.

---

## 16. Descarga de informe PDF

Desde el panel de detalle de cualquier evaluación (fila expandida en la tabla), el botón **"⬇ Descargar informe PDF"** genera un informe completo sin dependencias externas.

### Funcionamiento técnico
La función `descargarInformePDF(r: AuditMetricDetalle)`:
1. Construye un documento HTML completo en memoria con todos los ejes de evaluación.
2. Lo abre en una ventana nueva (`window.open("", "_blank")`).
3. Escribe el HTML y llama a `setTimeout(() => win.print(), 500)` para que el navegador renderice antes de mostrar el diálogo de impresión.
4. El usuario selecciona "Guardar como PDF" en el diálogo de impresión del navegador (estándar en Chrome, Firefox, Edge).

### Contenido del informe
| Sección | Métricas incluidas |
|---|---|
| **① Identificación** | Modo, red (chainId), URL RPC, fecha/hora, fuente (pandoras-box / simulación) |
| **② Eficiencia (TPS)** | TPS promedio y pico, total transacciones, exitosas, fallidas, blocktime, bloques observados |
| **③ Latencia** | Promedio, mínima, máxima, P95, clasificación semáforo con umbral |
| **④ Gas** | Gas promedio/máx por tx, gas limit, utilización % |
| **⑤ Seguridad** | Tasa de éxito, transacciones revertidas, out-of-gas, tiempo respuesta nodo |
| **⑥ Interoperabilidad EVM/HCE** | Nodo accesible, contrato accesible, deploy, llamadas ERC exitosas/total, compatibilidad, nota explicativa |

El informe no requiere conexión al backend; toda la información proviene del objeto `AuditMetricDetalle` ya cargado en el frontend.

---

## 17. Sección B — Tiempos medidos (interoperabilidad clínica)

La Sección B del dashboard de auditoría (`GET /evaluation/dashboard`) mide tres operaciones técnicas clave sobre los episodios existentes en el sistema, ejecutándolas 3–5 veces por episodio para calcular estadísticas de consistencia.

### Operaciones medidas

| Operación | Qué mide | Implementación |
|---|---|---|
| **Consulta de metadatos on-chain** | Tiempo de `obtenerRegistroOnChainMetadata(episodeId)` — lee el store de trazabilidad o llama al contrato (modo real) | `prototipoEvaluationService.ts` |
| **Acceso a documento off-chain** | Tiempo de `recuperarDocumentoClinico(episodeId)` — lectura desde HAPI FHIR o almacén en memoria | `documentoClinicoService.ts` |
| **Verificación de integridad** | Tiempo de calcular `SHA-256(documento_actual)` y comparar contra el hash registrado en la última traza blockchain | `prototipoEvaluationService.ts` |

### Cómo se calcula la consistencia

```
consistencia = clasificar(desviación_estándar(muestras_ms))
```

| Nivel | Condición | Significado |
|---|---|---|
| 🟢 Alta | `stdDev < 20 ms` | Respuesta estable; variación imperceptible para el usuario |
| 🟡 Media | `stdDev < 40 ms` | Variación tolerable; normal en operaciones de red local |
| 🔴 Baja | `stdDev ≥ 40 ms` | Alta variabilidad; revisar conectividad FHIR o nodo RPC |

> **Nota de diseño:** los umbrales son absolutos (ms), no coeficientes de variación. Un CoV haría que operaciones de 1–5 ms aparecieran siempre como "baja" (1 ms de variación sobre 2 ms de media = 50 % CoV) aunque sean perfectamente aceptables. Con umbrales absolutos, lecturas de memoria (<1 ms de stdDev) son automáticamente "alta".

### Por qué algunos episodios muestran integridad roja

La verificación de integridad compara:
```
hash_off_chain = SHA-256(documento_actual_recuperado)
hash_on_chain  = documentHash del último evento EPISODE_CREATED o EPISODE_UPDATED en trazabilidad
```

La integridad aparece en rojo (`revision_requerida` o `sin_evidencia`) cuando:

| Causa | Por qué ocurre | Solución |
|---|---|---|
| **FHIR caído al consultar** | `recuperarDocumentoClinico` no puede recuperar el documento → `hash_off_chain = undefined` | `docker compose up -d`, esperar 45 s, recargar dashboard |
| **FHIR caído durante el seed** | El seed guardó el hash updated en trazabilidad pero FHIR no persistió el documento actualizado → mismatch | Limpiar FHIR, volver a ejecutar seed con FHIR activo |
| **Sin datos de seed** | No hay episodios → `sin_evidencia` para todos | Ejecutar `npm run seed:eval-demo` |
| **Backend reiniciado sin FHIR** | Documentos solo en memoria (proceso seed) → perdidos al reiniciar | Configurar `FHIR_BASE_URL` para persistencia real |

### Caché de documentos en memoria

A partir del sprint 5, `recuperarDocumentoClinico` **guarda en caché** los documentos obtenidos de FHIR:

```
1ª llamada → almacenOffChain (vacío) → FHIR HTTP (~30-80 ms) → guarda en caché
2ª-5ª llamada → almacenOffChain (hit) → <1 ms
```

Esto garantiza que las 3–5 corridas de medición por episodio usen el mismo documento y tengan latencia estable → `stdDev` baja → consistencia "alta".

### Health-check de FHIR en el dashboard

El endpoint `GET /evaluation/dashboard` incluye ahora en `overview.fhir`:

```jsonc
"fhir": {
  "configurado": true,        // FHIR_BASE_URL está definida en .env
  "disponible": true,         // respondió /metadata en ≤ 5 s
  "almacenamiento": "hapi-fhir"  // o "memoria" si no está configurado
}
```

Cuando `configurado: true` pero `disponible: false`, el campo `limitations` del dashboard incluye una advertencia explicativa y el procedimiento de recuperación.

---

## 18. pandoras-box — corrección del bug en modo EOA

### Síntoma

Con mnemonic válido y fondos, en modo **EOA** las transacciones se ejecutan y descuentan fondos reales en Sepolia, pero el sistema reporta `fuente: "simulacion"` y no guarda los resultados reales. El error mostrado era:

> "pandoras-box ejecutó pero no generó archivo de salida. Verifica que el mnemonic tenga fondos suficientes en la red objetivo."

### Causa raíz

El adaptador pasa a pandoras-box `-o /tmp/pandoras-xxx/result-yyyy.json` (ruta absoluta en tmpdir). En modos ERC20/ERC721 pandoras-box respeta el flag `-o` y escribe en esa ruta. En modo **EOA**, pandoras-box puede ignorar `-o` y escribir `result.json` en el directorio de trabajo actual (`process.cwd()`). El adaptador solo verificaba la ruta de tmpdir → `existsSync(outFile) === false` → caía a simulación.

El mensaje de error era genérico (mencionaba "fondos") y no incluía stdout/stderr real, dificultando el diagnóstico.

### Corrección aplicada (`pandorasBoxAdapter.ts`)

1. Se captura `{stdout, stderr}` del proceso exitoso (antes se ignoraban).
2. Si el archivo no está en `outFile`, se busca en rutas alternativas:
   - Cualquier `.json` en `tmpDir`
   - `process.cwd()/result.json`
   - `process.cwd()/pandoras-result.json`
3. Si se encuentra en ruta alternativa → se parsea y se retorna como `fuente: "pandoras-box"`.
4. Si no se encuentra → el error incluye `stdout`/`stderr` real del proceso.

### Flujo corregido

```
execFileAsync(pandoras-box, [..., "--mode", "EOA", "-o", outFile])
    │
    ▼ exit 0 (éxito)
    │
    ├── existsSync(outFile) → true   → parsear, retornar fuente: pandoras-box ✅
    │
    ├── existsSync(outFile) → false
    │     │
    │     ├── buscar en tmpDir/*.json      → encontrado → parsear, retornar pandoras-box ✅
    │     ├── buscar en cwd/result.json    → encontrado → parsear, retornar pandoras-box ✅
    │     └── no encontrado en ningún lugar
    │           └── retornar error con stdout/stderr real del proceso
    │
    └── exit ≠ 0 (error) → capturar stderr + stdout → retornar error → caer a simulación
```

---

## 19. Corrección de throttling de Alchemy: swap de RPC para pandoras-box

### Causa raíz confirmada

El problema tiene dos causas simultáneas e interdependientes:

1. **Throttling de Alchemy (plan gratuito, ~330 CU/s):** al enviar 100 transacciones en ráfaga, pandoras-box agota el cupo de compute units antes de que lleguen todos los recibos.
2. **`"replacement transaction underpriced"`:** cuando Alchemy rechaza una llamada de estimación de gas (429), pandoras-box reintenta con el mismo nonce pero sin gas válido. El nodo rechaza el reintento como "underpiced". Este error es un síntoma secundario del throttling, no una causa independiente.

Ambos errores desembocan en el mismo resultado: pandoras-box alcanza su **timeout interno de 30 s** (hardcoded en el binario, no configurable por CLI) sin haber recolectado todos los recibos → sale con código no cero → el adaptador cae a simulación.

Desde este ajuste, el adaptador también intenta activar el **backend recovery** cuando detecta `REPLACEMENT_UNDERPRICED`, `replacement fee too low`, `replacement transaction underpriced` o un atasco en `Funding accounts...`. Si el recovery tampoco encuentra recibos suficientes, la corrida se persiste igualmente como `simulacion` para que el batch continúe.

> **Recomendación operativa:** para cargas > 100 transacciones use un RPC privado (Alchemy/Infura). Los nodos públicos de Sepolia pueden introducir throttling, errores de gas y timeouts.

Reducir el batch size a `-b 10` (corrección anterior) alivia la presión pero no elimina el problema: en condiciones de alta carga de la testnet o con muchas subcuentas, el throttling de Alchemy persiste.

### Solución definitiva: swap del RPC en pandoras-box

El adaptador ahora detecta si la URL configurada pertenece a Alchemy y, de ser así, reemplaza el flag `-url` que pasa a pandoras-box por el endpoint público de Ankr para Sepolia, que no tiene throttling agresivo compatible con el patrón de envío en ráfaga de pandoras-box.

```
URL configurada (Alchemy)  →  sigue usándose para: getChainId, fetchRealBlockData,
                               consultas de bloque, interoperabilidad EVM
                           →  NO se pasa a pandoras-box

ANKR_SEPOLIA_RPC (Ankr)    →  solo se usa como -url en pandoras-box
```

### Cambio aplicado en `backend/src/audit/pandorasBoxAdapter.ts`

**Lista de candidatos y función de probe (antes de `TipoErrorAlchemy`):**

```typescript
const SEPOLIA_RPC_CANDIDATOS = [
  "https://rpc.ankr.com/eth_sepolia",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://rpc2.sepolia.org",
];

async function resolverRpcAlternativo(candidatos: string[]): Promise<string | null> {
  for (const url of candidatos) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3_000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json() as { result?: string };
        if (json.result) return url;
      }
    } catch {
      // RPC no accesible o timeout → probar el siguiente
    }
  }
  return null;
}
```

**Selección de RPC en `tryRunPandorasBox` (antes del bloque `try`):**

```typescript
let rpcUrlParaPandoras = config.rpcUrl;
if (esUrlAlchemy(config.rpcUrl)) {
  const alternativo = await resolverRpcAlternativo(SEPOLIA_RPC_CANDIDATOS);
  if (alternativo) {
    console.log(`[pandoras-box] RPC alternativo seleccionado: ${alternativo}`);
    rpcUrlParaPandoras = alternativo;
  } else {
    console.log(`[pandoras-box] Ningún RPC alternativo respondió; usando Alchemy como último recurso.`);
  }
}
```

El flag `-url` en la construcción de `args` ya usa `rpcUrlParaPandoras` (sin cambio adicional).

**Flujo de selección:**

```
esUrlAlchemy(config.rpcUrl) === true
  │
  ├── probe rpc.ankr.com/eth_sepolia        (timeout 3 s)
  │     OK → rpcUrlParaPandoras = ankr   ✅ log + usar
  │     FAIL →
  ├── probe ethereum-sepolia-rpc.publicnode.com
  │     OK → usar                        ✅ log + usar
  │     FAIL →
  ├── probe sepolia.drpc.org
  │     OK → usar                        ✅ log + usar
  │     FAIL →
  ├── probe rpc2.sepolia.org
  │     OK → usar                        ✅ log + usar
  │     FAIL →
  └── ninguno respondió → log + usar Alchemy original (último recurso)
```

### Correcciones de mensajes aplicadas (sprint anterior, documentadas aquí)

**`frontend/src/pages/AuditoriaDashboardPage.tsx` — línea 407:**
```diff
- batchSize: 20,
+ batchSize: 10,
```

**`backend/src/routes/audit.ts`** — el campo `message` de la respuesta distingue tres casos:

| Caso | `message` |
|---|---|
| Éxito con pandoras-box | `"Evaluación completada · Ejecución directa con pandoras-box en Sepolia. ID: …"` |
| Simulación por fallo de pandoras-box | `"Evaluación completada · Simulación con datos del nodo RPC (pandoras-box no pudo ejecutarse). ID: …"` |
| Simulación sin mnemonic | `"Evaluación completada · Simulación con datos del nodo RPC (sin mnemonic configurado). ID: …"` |

### Limitaciones técnicas confirmadas

| Corrección | Factible | Motivo |
|---|---|---|
| Swap RPC Alchemy → Ankr para pandoras-box | ✅ | Implementado |
| Reducir `batchSize` de 20 a 10 | ✅ | Implementado |
| Delay entre batches (500 ms) | ❌ | pandoras-box no expone flag de delay; único control es `-b` |
| Timeout de recibos 30 s → 60 s por CLI / 120 s recovery backend | ⚠️ Parcial | El adaptador detecta si el binario soporta `--timeout`, `--wait-timeout` o `--receipt-timeout`; si no, activa recovery backend y luego simulación |

### Mecanismo de respaldo — sin cambios

Si pandoras-box falla por cualquier causa (Ankr caído, Sepolia con congestión extrema, saldo insuficiente, binario no instalado), el sistema sigue cayendo a simulación con datos del nodo RPC. El campo `advertencia` de la respuesta contiene el detalle del error para diagnóstico.

---

## 20. Estado de cumplimiento del RF10

| Entregable | Estado |
|---|---|
| Endpoints REST (`GET /audit/metrics`, `GET /audit/metrics/:id`, `POST /audit/run`) | ✅ Operativos |
| Integración real con pandoras-box (flags `-url`, `-m`, `-t`, `-s`, `--mode`, `-o`) | ✅ Corregido |
| Diagnóstico de error cuando pandoras-box falla (campo `advertencia`) | ✅ Implementado |
| Simulación realista con datos del nodo RPC como fallback | ✅ Implementado |
| Métricas de seguridad (reverts, out-of-gas, respuesta del nodo) | ✅ Implementado |
| Interoperabilidad: semáforo con 4 condiciones + objeto `interoperabilityDetails` | ✅ Sprint 5 |
| Umbrales de latencia para red hospitalaria (30 s / 60 s) | ✅ Ajuste posterior |
| Corrección de métricas de timing siempre vacías en Sección B | ✅ Sprint 5 |
| Sesiones de evaluación: endpoints REST + UI con filtro por sesión | ✅ Sprint 5 |
| Descarga de informe PDF desde el panel de detalle | ✅ Sprint 5 |
| Script de datos demo: género alternado, 7 EPS colombianas, signos vitales por CIE-10 | ✅ Sprint 5 |
| Vista del auditor: tabla + semáforos + detalle expandible + gráficas SVG | ✅ Implementado |
| Sección B — interoperabilidad clínica (HU0-HU5) embebida en misma página | ✅ Implementado |
| Sección B — umbrales absolutos de consistencia (stdDev < 20/40 ms) | ✅ Sprint 5 |
| Sección B — caché de documentos FHIR en memoria (evita CoV alto en mediciones) | ✅ Sprint 5 |
| Sección B — health-check FHIR en `overview.fhir` del dashboard | ✅ Sprint 5 |
| Bug pandoras-box modo EOA: búsqueda de archivo en rutas alternativas + stderr real | ✅ Sprint 5 |
| Corrección throttling Alchemy: `batchSize` default 20 → 10 (frontend + fallback backend) | ✅ Sprint 5 |
| Mensajes de respuesta distinguen "ejecución directa con pandoras-box" vs "simulación RPC" | ✅ Sprint 5 |
| Fallback de RPCs públicos de Sepolia para pandoras-box (Ankr → PublicNode → drpc → rpc2, probe 3 s c/u) | ✅ Sprint 5 |
| Diagramas de arquitectura (`docs/arquitectura/`) | ✅ Sprint 5 |
| Build sin errores (`npm run build` en backend y frontend) | ✅ Confirmado |
| Rate limit Alchemy: batchSize=5 automático + mensajes diferenciados "txs SÍ enviadas" | ✅ Sprint 5 |
| Tarjeta "Estado del entorno" en Sección B (FHIR / blockchain / nota simulación) | ✅ Sprint 5 |
| Seed: omite EPISODE_UPDATED en trazabilidad si FHIR no persiste (integridad consistente) | ✅ Sprint 5 |

---

## 20. Qué métricas son reales y cuáles son estimadas o sintéticas

Esta sección responde la pregunta más importante para interpretar los resultados del módulo RF10: **¿qué estoy midiendo realmente?**

La respuesta varía según la sección del dashboard y el modo de ejecución.

---

### 20.1 Sección A — Pruebas de estrés (pandoras-box)

#### Modo ejecución real (`fuente: "pandoras-box"`)

Este modo se activa cuando se proporciona un mnemonic con fondos en la red objetivo. pandoras-box envía transacciones reales a la blockchain y reporta los datos de los bloques donde quedaron incluidas.

| Métrica | ¿Es real? | Origen |
|---|---|---|
| **TPS promedio** | ✅ Real | pandoras-box mide las transacciones confirmadas sobre la duración total observada |
| **TPS pico** | ✅ Derivado de datos reales | El adaptador calcula `max(numTxs_bloque / blocktime)` usando los datos reales de cada bloque |
| **Blocktime promedio/mín/máx** | ✅ Real | Diferencia de timestamps entre bloques consecutivos reportados por pandoras-box |
| **Gas usado (promedio y máx)** | ✅ Real | Valores hex `gasUsed` / `gasLimit` del bloque, tal como los reporta el nodo Ethereum |
| **Utilización de gas (%)** | ✅ Derivado de datos reales | `(gas usado) / (gasLimit × bloques)`, calculado sobre valores reales |
| **Transacciones exitosas** | ✅ Real | Número de transacciones que aparecen en bloques según pandoras-box |
| **Transacciones fallidas** | ⚠️ Aproximado | Se infieren como `totalEnviadas − txEnBloques`; pandoras-box no distingue entre revert, out-of-gas y timeout |
| **Latencia de confirmación** | ⚠️ Estimada | pandoras-box **no registra el timestamp de envío individual** de cada transacción. La latencia se estima como `blocktime × 1.15`, que representa la cota inferior realista (esperar al menos 1 bloque completo). No es la latencia exacta de ninguna transacción específica |
| **P95 / P99 de latencia** | ⚠️ Estimados | Se derivan de la latencia promedio con factores fijos (`avg × 1.6` y `avg × 2.1`); pandoras-box no provee percentiles individuales |
| **Transacciones revertidas** | ⚠️ Estimado | Se toma como el 70 % de las fallidas (heurística; pandoras-box no expone desglose) |
| **Transacciones out-of-gas** | ⚠️ Estimado | El 30 % restante de las fallidas |
| **Tiempo de respuesta del nodo** | ⚠️ Estimado | Heurística: `blocktime × 0.08` (≈ 8 % del blocktime); pandoras-box no mide latencia JSON-RPC individual |
| **Transacciones enviadas** | ✅ Real | La cuenta del mnemonic gasta ETH real en Sepolia; las transacciones existen en la blockchain |

> **Resumen modo real:** TPS, gas y blocktime son completamente reales. La latencia y el desglose de fallos son aproximaciones con base en los datos reales de bloques. Las transacciones sí se ejecutan y consumen ETH de Sepolia.

#### Modo simulación (`fuente: "simulacion"`)

Se activa cuando no hay mnemonic, pandoras-box no está instalado (`ENOENT`), o pandoras-box falló (fondos insuficientes, rate limit de Alchemy, etc.).

| Métrica | ¿Es real? | Origen |
|---|---|---|
| **Blocktime promedio** | ✅ Real (si el nodo responde) | El adaptador consulta los últimos 10 bloques del nodo via `eth_getBlockByNumber` y mide timestamps reales |
| **chainId** | ✅ Real | Consultado directamente al nodo via `eth_chainId` |
| **TPS promedio** | ⚠️ Sintético | Generado con distribución normal calibrada por `chainId` (ej. Sepolia → media 12 TPS) |
| **Gas por bloque** | ⚠️ Sintético | Estimado según el modo (EOA: 21 000, ERC20: 50 000, ERC721: 120 000) con varianza aleatoria |
| **Latencia** | ⚠️ Sintética | Calculada a partir del blocktime real + ruido gaussiano |
| **Transacciones exitosas/fallidas** | ⚠️ Sintético | Porcentaje de fallo fijo por modo (EOA: 1.5 %, ERC20: 2.5 %, ERC721: 3 %) + varianza aleatoria |
| **Transacciones enviadas** | ❌ No se envía nada | En modo simulación **no se envía ninguna transacción a la red**; el ETH del mnemonic no se toca |

> **Resumen modo simulación:** los bloques consultados al nodo son reales (blocktime, chainId), pero las métricas de carga (TPS, gas, fallos, latencia) son completamente sintéticas. No se gasta ETH. Es útil para estimar el comportamiento de la red sin riesgo de gasto.

#### Por qué la simulación aún usa el nodo RPC

Incluso en modo simulación, el adaptador consulta el nodo (`eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`) para:
1. Obtener el blocktime real de Sepolia en ese momento (12 s promedio en PoS post-merge).
2. Calibrar los parámetros de la distribución normal con datos del nodo actual.
3. Mostrar el chainId correcto en la tarjeta de entorno del dashboard.

Esto hace que la simulación sea "realista" (parámetros anclados en la red real) aunque los valores de carga sean sintéticos.

---

### 20.2 Sección B — Interoperabilidad clínica (`/evaluation/dashboard`)

La Sección B no envía transacciones. Mide el comportamiento del sistema backend sobre los episodios clínicos existentes.

#### Tiempos de acceso (3 operaciones)

| Operación | ¿Es real? | Qué mide |
|---|---|---|
| **Metadatos on-chain** (`obtenerRegistroOnChainMetadata`) | ✅ Real | Tiempo real de leer el store de trazabilidad (`episodio-trazabilidad.json`) o llamar al contrato en Sepolia (si blockchain real) |
| **Documento off-chain** (`recuperarDocumentoClinico`) | ✅ Real | Tiempo real de: (1ª llamada) HTTP a HAPI FHIR, o (llamadas 2–5) lectura del caché en memoria |
| **Verificación de integridad** | ✅ Real | Tiempo real de calcular `SHA-256(documento_canonico)` y comparar con el hash en trazabilidad |
| **Consistencia** (stdDev de 3–5 muestras) | ✅ Real | Calculada sobre tiempos medidos reales; no se fabrican los números |

> **Nota:** la 1ª llamada al documento es más lenta (HTTP a FHIR ~30–80 ms) que las siguientes (caché en memoria <1 ms). La métrica "acceso a documento off-chain" refleja el tiempo real de la primera llamada; las siguientes muestras son casi cero, lo que baja el promedio. Esto es el comportamiento real del sistema con caché habilitado.

#### Escenarios de interoperabilidad

| Dato | ¿Es real? | Origen |
|---|---|---|
| **Total episodios** | ✅ Real | Conteo de todos los episodios registrados en el sistema (FHIR o memoria) |
| **Total IPS simuladas** | ✅ Real | Conteo de IPSs registradas en `backend/data/ips.json` |
| **Episodios multi-IPS** | ✅ Real | El sistema analiza qué episodios tienen permisos concedidos a IPSs distintas a la propietaria |
| **Integridad** (`integro` / `revision_requerida` / `sin_evidencia`) | ✅ Real | Comparación SHA-256 real entre el documento actual y el hash registrado en trazabilidad |
| **Continuidad asistencial** (`hasCrossIpsContinuity`) | ✅ Real | Se detecta si el episodio tiene eventos de acceso desde una IPS distinta a la dueña |
| **Flujo de permisos** (`hasPermissionFlow`) | ✅ Real | Presencia de eventos `PERMISSION_GRANTED` en la trazabilidad del episodio |
| **Validación del modelo HCE** | ✅ Real | Ejecución del schema Zod contra el documento recuperado; no es un flag hardcodeado |

#### Rendimiento blockchain en Sección B

| Modo | ¿Son reales los costos/latencias? |
|---|---|
| `blockchainMode: "real"` | ✅ Las latencias de confirmación y costos en gas son los registrados cuando se enviaron las transacciones reales |
| `blockchainMode: "mock"` | ⚠️ Los costos y latencias son **estimados** a partir de valores típicos de la red; no se enviaron transacciones |

---

### 20.3 Los datos clínicos (episodios) son sintéticos, las mediciones son reales

Es importante distinguir dos cosas:

| Aspecto | Naturaleza |
|---|---|
| **Los episodios clínicos** (pacientes, diagnósticos, signos vitales) | ⚠️ Sintéticos si vienen del script `seed-evaluacion-demo.ts` (datos ficticios estructuralmente válidos según RDA/FHIR); o reales si fueron creados por un usuario a través de la DApp |
| **Las mediciones** (tiempos de acceso, hashes, consistencia) | ✅ Siempre reales — se miden sobre los datos que existan en el sistema, independientemente de si son seed o no |

El script de seed genera datos ficticios pero clínicamente estructurados (siguiendo la norma RDA-FHIR) para tener episodios sobre los cuales medir. Las métricas que el dashboard calcula sobre esos episodios son mediciones reales del sistema.

---

### 20.4 Tabla resumen: real vs. estimado vs. sintético

| Sección | Métrica | Con pandoras-box real | Con simulación | Con blockchain real |
|---|---|---|---|---|
| A | TPS promedio | ✅ Real | ⚠️ Sintético | — |
| A | Blocktime | ✅ Real | ✅ Del nodo | — |
| A | Gas | ✅ Real | ⚠️ Estimado | — |
| A | Latencia | ⚠️ Estimada | ⚠️ Sintética | — |
| A | Fallos/reverts | ⚠️ Aproximado | ⚠️ Sintético | — |
| A | ETH gastado | ✅ Real (Sepolia) | ❌ Nada | — |
| B | Tiempos de acceso | — | — | ✅ Reales |
| B | Consistencia (stdDev) | — | — | ✅ Real |
| B | Integridad hash | — | — | ✅ Real |
| B | Multi-IPS / permisos | — | — | ✅ Real |
| B | Costos blockchain | — | — | ✅ Real (modo real) / ⚠️ Estimado (modo mock) |

---

### 20.5 Cómo identificar en la UI qué tipo de dato estás viendo

| Indicador | Ubicación | Qué dice |
|---|---|---|
| 🔴 "Ejecución real con pandoras-box" | Banner después de ejecutar prueba en Sección A | Las transacciones se enviaron a Sepolia; TPS, gas y blocktime son reales |
| 🔵 "Simulación (datos del nodo RPC)" | Banner después de ejecutar prueba en Sección A | No se envió nada; solo blocktime y chainId son reales |
| ⚠️ Banner amarillo con detalle | Aparece cuando pandoras-box falló y se usó simulación | Indica el motivo exacto del fallo (fondos, rate limit, etc.) |
| Tarjeta "Estado del entorno" | Sección B del dashboard | Muestra si FHIR está activo (tiempos reales vs. memoria) y si la blockchain es real o mock |
| `fuente` en el JSON del registro | Campo persistido en `audit-metrics.json` | `"pandoras-box"` = datos reales de la red; `"simulacion"` = datos sintéticos |
| `metricsMode` por operación en Sección B | `blockchainPerformance.operations[].metricsMode` | `"medido"` = dato real; `"estimado"` = aproximación; `"no_disponible"` = sin evidencia |

---

## 21. Mejoras a la Sección B — Sprint 6

### 21.1 Exportación PDF de la Sección B

Se agregó la función `descargarInformeSeccionBPDF(d: DashboardEvaluacionPrototipo)` en `AuditoriaDashboardPage.tsx`. Genera un informe HTML completo de la Sección B y lo abre en una ventana nueva para imprimir como PDF (Ctrl+P → "Guardar como PDF").

**Contenido del informe PDF Sección B:**
1. Resumen general (episodios, trazas, IPS, modo blockchain)
2. Catálogo de HUs evaluadas (HU0-E6 a HU5-E6) con título, descripción e interpretación
3. Tiempos de acceso y verificación con umbrales de referencia e interpretación por métrica
4. Escenarios de interoperabilidad entre IPS
5. Costo y rendimiento blockchain por tipo de transacción
6. Actores observados y hallazgos que requieren revisión
7. Requisitos validados con estado de cumplimiento

**Acceso:** botón "Descargar PDF Sección B" en la cabecera de la Sección B (`/auditoria/metricas`).

> Nota: El PDF de la Sección A ya existía como `descargarInformePDF(r: AuditMetricDetalle)`, accesible desde el panel de detalle de cada evaluación. Ambas funciones son independientes y no requieren librerías externas.

### 21.2 Métricas de timing enriquecidas

Las tres métricas de timing de la Sección B (Metadatos on-chain, Documento off-chain, Verificación de integridad) se enriquecieron con:

| Campo | Descripción |
|---|---|
| **Descripción** | Qué mide la métrica y de dónde obtiene los datos |
| **Umbral de referencia** | Rangos esperados según el entorno (mock / FHIR local / blockchain real) |
| **Interpretación dinámica** | Texto que varía según el valor y el número de muestras obtenidas |

Se implementó el componente `TimingCardEnriquecida` que reemplaza la tarjeta resumida anterior. El catálogo de metadatos por métrica vive en `TIMING_META` (diccionario estático en el mismo archivo).

### 21.3 Catálogo de historias de usuario (HU0-HU5)

Se agregó el diccionario `HU_CATALOGO` con la siguiente información por cada HU:

| HU | Título |
|---|---|
| HU0-E6 | Evaluar el flujo de interoperabilidad entre múltiples IPS |
| HU1-E6 | Medir tiempos de acceso y verificación de información clínica |
| HU2-E6 | Evaluar el costo y rendimiento de las transacciones blockchain |
| HU3-E6 | Validar la integridad y trazabilidad del sistema |
| HU4-E6 | Validar el cumplimiento del modelo HCE y los requisitos del sistema |
| HU5-E6 | Documentar los resultados y conclusiones del prototipo |

Cada entrada incluye `titulo`, `descripcion` (qué evalúa) e `interpretacion` (qué indica el resultado). Se presenta tanto en la vista web como en el PDF exportado.

### 21.4 Consolidación de datos en `/auditoria/metricas`

La Sección B de `/auditoria/metricas` ahora incluye toda la información que antes solo estaba disponible en `/auditoria/evaluacion`:

| Subsección | Antes (Sección B) | Después (Sección B consolidada) |
|---|---|---|
| Catálogo HUs con descripción | ❌ | ✅ Grid con título, descripción e interpretación |
| Tarjetas resumen con HU asociada | Genérica | Etiquetada por HU (HU0-E6, HU2-E6, etc.) |
| Panel de conclusiones | ❌ | ✅ (Interop., Tiempos, Blockchain) |
| Tiempos de acceso detallados | Solo valores | ✅ Con umbral, interpretación, desviación y consistencia |
| Escenarios de interoperabilidad | ✅ | ✅ (sin cambios) |
| Costo y rendimiento blockchain | ❌ | ✅ Tabla por tipo de operación |
| Actores observados | ❌ | ✅ Tabla con roles, eventos e IPS |
| Hallazgos con revisión | ❌ | ✅ Lista de episodios con issues |
| Requisitos validados | Colapsable | ✅ Expandido por defecto |
| IPS simuladas | ❌ | ✅ Badges visuales |
| Exportar PDF Sección B | ❌ | ✅ Botón en cabecera |

La Sección A no fue modificada.

---

## 22. Correcciones de bugs en la Sección B — Sprint 6

### 22.1 Problema 1 — Verificador de integridad compara contra hash incorrecto

**Síntoma:** 18 de 27 episodios mostraban `integrityStatus: "revision_requerida"`. Todos los afectados tenían exactamente 2 versiones (creación + actualización).

**Causa raíz:** Race condition en la indexación asíncrona de HAPI FHIR. Cuando el seed crea y actualiza un episodio rápidamente, `upsertSnapshotDocumentReference` no encontraba el snapshot recién creado (aún no indexado por HAPI FHIR) y creaba un **segundo snapshot**. Posteriormente, `retrieveEpisodeFromFhir` usaba `findSnapshotByEpisodeId` que retornaba el snapshot más antiguo (V1), cuyo hash correspondía al documento original — no al actualizado (V2).

**Archivos modificados:** `backend/src/hce/fhirStorageService.ts`

**Correcciones aplicadas:**

1. `findSnapshotByEpisodeId` — ahora usa `_sort=-_lastUpdated` y `_count=1` para retornar siempre el snapshot más reciente:
   ```typescript
   const bundle = await searchResources("DocumentReference", {
     identifier: `${EPISODE_SNAPSHOT_SYSTEM}|${episodeId}`,
     _sort: "-_lastUpdated",
     _count: "1"
   });
   ```

2. `upsertSnapshotDocumentReference` — busca **todos** los snapshots existentes, actualiza el más reciente y elimina los duplicados obsoletos para prevenir futuras lecturas inconsistentes.

**Resultado:** 27/27 episodios pasan a `integro`. RF8 pasa de `parcial` a `cumple`.

---

### 22.2 Problema 2 — RF8 y RF9 aparecen como "parcial" sin explicación suficiente

**Síntoma:** Los requisitos RF8 y RF9 se mostraban como `parcial` sin detalle sobre qué faltaba para cumplirlos.

**Causa raíz de RF8:** Consecuencia directa del Problema 1 — los 18 episodios con hash incorrecto generaban `integrityIssues`, lo que forzaba `status: "parcial"` para RF8.

**Causa raíz de RF9:** La condición `cumpleHu1E5 = contratosOperativos && ipsConsolidadas.length >= 2` fallaba porque `ipsConsolidadas` solo contenía IPS del Map `ipsSimuladas` (vacío — ver Problema 3). El mensaje de detalle era genérico y no explicaba qué condición fallaba.

**Archivos modificados:** `backend/src/evaluation/prototipoEvaluationService.ts`

**Corrección aplicada:** El detalle de RF9 ahora es condicional y específico. Indica exactamente qué falta:
- Si blockchain no está habilitada **y** hay < 2 IPS: lista ambas condiciones.
- Si solo blockchain no está habilitada: indica cómo configurar `BLOCKCHAIN_TRACE_MODE`.
- Si solo faltan IPS: indica cuántas hay y cuántas se requieren.

**Resultado:** RF8 y RF9 pasan a `cumple`. Los cuatro requisitos (RF8–RF11) muestran `cumple`.

---

### 22.3 Problema 3 — IPS simuladas aparece como 0

**Síntoma:** `simulacionIps.total` mostraba 0 a pesar de que los episodios demo involucran IPS-001 a IPS-006.

**Causa raíz:** El campo se calculaba desde `ipsSimuladas`, un `Map` en memoria que solo se alimenta por `POST /infra/ips`. El seed de datos demo (`seed-evaluacion-demo.ts`) crea IPS-003 a IPS-006 via `crearIps()` del `ipsService`, que es otro `Map` en memoria en un **proceso separado** — las IPS no sobreviven al fin del proceso del seed.

**Archivos modificados:** `backend/src/infra/infraestructuraService.ts`

**Corrección aplicada:** La función `obtenerEstadoInfraestructura` ahora consolida IPS de tres fuentes:

| Fuente | Persistencia | IPS que aporta |
|---|---|---|
| `ipsSimuladas` (POST /infra/ips) | Memoria (mismo proceso) | Las configuradas manualmente |
| `listarIpsActivas()` (ipsService) | Memoria (hardcoded seeds) | IPS-001, IPS-002 |
| `listarEventosTrazabilidad()` (trazabilidadService) | **JSON persistido** | Todas las IPS que participaron en eventos (IPS-001 a IPS-006) |

Se excluyen identificadores no-IPS como `"AUDITORIA"`, `"SISTEMA"`, `"ADMIN"` que corresponden a roles especiales.

**Resultado:** `simulacionIps.total` muestra 6 IPS. IPS-001 e IPS-002 conservan sus nombres completos del seed hardcoded; IPS-003 a IPS-006 se descubren desde los eventos de trazabilidad persistidos.

---

### 22.4 Resumen de impacto

| Métrica | Antes | Después |
|---|---|---|
| Episodios con integridad verificada | 9/27 (33%) | 27/27 (100%) |
| RF8 (Verificación de integridad) | `parcial` | `cumple` |
| RF9 (Interfaz DApp) | `parcial` | `cumple` |
| IPS simuladas detectadas | 0 | 6 |
| `multipleIpsActivo` | `false` | `true` |
| `cumpleHu1E5` | `false` | `true` |

---

## 23. Transición de modo mock a blockchain real (Sepolia) — Sprint 6

### 23.1 Contexto

La Sección B originalmente operaba con `BLOCKCHAIN_TRACE_MODE=mock`, donde las transacciones se simulaban localmente con tiempos y costos estimados (emitterId: `mock-backend-signer`, metricsMode: `estimated`). Se migró a modo real para que cada operación clínica firme y envíe transacciones reales a la red Sepolia.

### 23.2 Variables de entorno modificadas

| Variable | Valor anterior | Valor nuevo | Archivo |
|---|---|---|---|
| `BLOCKCHAIN_TRACE_MODE` | `auto` (operaba como mock sin contrato compatible) | `auto` (opera como real con contrato re-desplegado) | `backend/.env` |
| `InterHCELedger` address | `0xEdf3b264...D166` | `0x34C09c91c8B9dE148f4e17c5896A4ee0965fE9b0` | `shared/blockchain/contracts.sepolia.json` |

**Nota:** `SEPOLIA_RPC_URL` y `DEPLOYER_PRIVATE_KEY` ya estaban configurados. No se crearon variables nuevas.

### 23.3 Re-despliegue del contrato

El contrato originalmente desplegado (`0xEdf3b264...D166`) tenía un bug en el modifier `onlyClinicalActor`: solo aceptaba `Rol.ProfesionalSalud`, excluyendo `Rol.AdminIps`. El código fuente corregido acepta ambos roles:

```solidity
modifier onlyClinicalActor() {
    require(usuarios[msg.sender].activo, "Usuario inactivo");
    Rol rol = usuarios[msg.sender].rol;
    require(
        rol == Rol.ProfesionalSalud || rol == Rol.AdminIps,
        "Rol no autorizado"
    );
    _;
}
```

Se recompiló (`npx hardhat clean && npx hardhat compile`) y re-desplegó (`npm run deploy:sepolia`) el contrato. El script de deploy actualizó automáticamente `shared/blockchain/contracts.sepolia.json` con la nueva dirección.

**Wallet del backend (deployer y owner):** `0x580E296fbC145bfCB2A33891FCb7e116392c4dD6`
- Rol asignado por el constructor: `AdminIps` (3)
- Satisface tanto `onlyClinicalActor` como `onlyRol(AdminIps)`

### 23.4 Ejecución del seed con transacciones reales

```bash
cd backend
RESET_DEMO_CONFIRM=YES npm run reset:demo-data   # limpiar JSON mock
docker compose down -v && docker compose up -d     # FHIR limpio
# esperar ~90s a que FHIR arranque
SEED_BLOCKCHAIN_REAL=1 npm run seed:eval-demo      # 117 txs reales
```

**Duración total del seed:** ~30 minutos (117 transacciones × ~15s confirmación promedio).

### 23.5 Resultados observados — métricas reales vs. estimadas

| Operación | N | Confirmación (ms) | Gas usado | Costo (gwei) | Modo |
|---|---|---|---|---|---|
| Creación de episodio | 27 | 12,554 | 141,269 | 141.3 | medido |
| Otorgamiento de permiso | 18 | 14,042 | 29,833 | 29.8 | medido |
| Acceso auditable | 18 | 13,283 | 34,658 | 34.7 | medido |
| Actualización de episodio | 18 | 12,584 | 44,889 | 44.9 | medido |
| Verificación de integridad | 18 | 13,282 | 34,058 | 34.1 | medido |
| Revocación de permiso | 18 | 15,022 | 29,821 | 29.8 | medido |

**Emisor en todos los eventos:** `0x580E296fbC145bfCB2A33891FCb7e116392c4dD6` (dirección real de la wallet del backend).

### 23.6 Comparación mock vs. real

| Métrica | Mock (estimado) | Real (medido) | Observación |
|---|---|---|---|
| emitterId | `mock-backend-signer` | `0x580E296f...4dD6` | Dirección Ethereum real |
| metricsMode | `estimated` | `measured` | Datos reales de recibos de transacción |
| Confirmación (episodio) | ~1,280 ms | ~12,554 ms | Sepolia blocktime real (~12s) |
| Gas (episodio) | 205,000 (hardcoded) | 141,269 (medido) | El gas real es menor al estimado conservador |
| Gas (permiso) | 128,000 (hardcoded) | 29,833 (medido) | El permiso emite solo un evento, gas muy bajo |
| Costo total seed | 0 ETH | 0.000764 ETH | Costo real negligible en testnet |
| blockNumber | 0 | 10,522,xxx | Bloques reales de Sepolia |
| explorerUrl | Hash SHA-256 sintético | `https://sepolia.etherscan.io/tx/0x...` | Verificable en Etherscan |

### 23.7 Estado final del dashboard

| Campo | Valor |
|---|---|
| Blockchain mode | `real` |
| Metric kind | `medido` |
| Episodios | 27 |
| Trace events | 117 |
| IPS simuladas | 6 |
| Integridad | 27/27 íntegro |
| RF8–RF11 | Todos `cumple` |
| Balance wallet restante | 0.0875 ETH |

### 23.8 Impacto en la evaluación

- El campo `blockchainPerformance.metricKind` cambió de `"estimado"` a `"medido"`.
- Los tiempos de confirmación reflejan el blocktime real de Sepolia (~12-15s) en vez de milisegundos sintéticos.
- Los costos de gas son valores reales de los recibos de transacción, no estimaciones hardcoded.
- Cada evento de trazabilidad tiene un `transactionHash` verificable en Etherscan y un `blockNumber` real.
- El emisor (`emitterId`) es la dirección `0x` de la wallet, no el placeholder `mock-backend-signer`.

---

## 24. Recolector de recibos del backend — fallback para timeout de pandoras-box

### 24.1 Contexto del problema

pandoras-box envía las transacciones exitosamente (stdout: `"✅ N batches sent"`) pero falla al recolectar los recibos porque tiene un **timeout interno de 30 s** por transacción en la fase de recolección individual (`waitForTransaction(hash, 1, 30000)` en `collector.js`). Este valor está **hardcoded en el binario** — no existe flag de CLI para configurarlo.

Síntoma observable en el stdout de pandoras-box:

```
Sending transactions in batches...
[barra de progreso]
✅ 10 batches sent

⏱ Statistics calculation initialized ⏱

Gathering transaction receipts...
[barra de progreso — parcial]
⛔️ Error: timeout exceeded
```

El proceso termina con código de salida no-cero, pero **las transacciones sí se enviaron a Sepolia** y muchas se minan en los segundos/minutos siguientes.

### 24.2 Solución: recolector de recibos del backend

Cuando `pandorasBoxAdapter.ts` detecta `"batches sent"` en el stdout de un proceso fallido, **no cae a simulación**. En su lugar activa el recolector de recibos del backend:

```
pandoras-box falla (stdout contiene "batches sent")
        │
        ▼
recolectarRecibosDesdeNodo()
        │
        ├─► Deriva direcciones: Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/${i}")
        │     i=1..numSubcuentas (mismo path HD que pandoras-box/signer.js)
        │
        ├─► Escanea bloques startBlock..currentBlock (máx. 60 bloques)
        │     eth_getBlockByNumber(n, true) → filtra por tx.from ∈ senderAddresses
        │
        ├─► Recolecta recibos: eth_getTransactionReceipt(hash) con timeout 120 s
        │
        └─► Calcula métricas: TPS, latencia (aprox.), gas, tasa de éxito
                │
                ▼
        fuente: "pandoras-box-recovery"
        message: "Ejecución directa con pandoras-box (recibos recolectados por backend)"
```

### 24.3 Ruta HD derivada

pandoras-box usa el índice 0 del mnemonic como cuenta distribuidora (fondea las subcuentas) y los índices 1..numSubcuentas como cuentas emisoras. La ruta de derivación BIP-32 es:

```
m/44'/60'/0'/0/0   → distribuidor (no envía txs de prueba)
m/44'/60'/0'/0/1   → subcuenta 1 (emisora)
m/44'/60'/0'/0/2   → subcuenta 2 (emisora)
...
m/44'/60'/0'/0/N   → subcuenta N (emisora)
```

El backend usa exactamente el mismo path con `ethers@5`:

```typescript
import { Wallet } from "ethers";
const w = Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
```

### 24.4 Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/package.json` | Añadido `"ethers": "^5.x"` a dependencias |
| `backend/src/audit/pandorasBoxAdapter.ts` | Import `Wallet` de ethers; interfaces `RpcTxInBlock`, `RpcBlockWithTxs`, `RpcReceipt`; funciones `getBlockWithFullTxs`, `getTransactionReceipt`, `recolectarRecibosDesdeNodo`; `tryRunPandorasBox` registra `inicioMs` y `startBlock` antes de `execFileAsync`, detecta `"batches sent"` en el catch y activa recovery; `ejecutarPrueba` devuelve `fuente: "pandoras-box-recovery"` cuando `isRecovery === true` |
| `backend/src/audit/auditMetricModel.ts` | Tipo `fuente` extendido a `"pandoras-box" \| "pandoras-box-recovery" \| "simulacion"` |
| `backend/src/audit/auditMetricsService.ts` | Firmas de `convertirASalida` y `ejecutarEvaluacion` actualizadas con el nuevo fuente |
| `backend/src/routes/audit.ts` | Nuevo caso en el mensaje de respuesta para `"pandoras-box-recovery"` |

### 24.5 Limitaciones conocidas del recolector

| Aspecto | Detalle |
|---|---|
| **Latencia** | No hay timestamp de envío individual por tx; se usa el punto medio del intervalo de prueba como aproximación conservadora |
| **Alcance del escaneo** | Máximo 60 bloques desde `startBlock`. Si las txs tardan más de ~12 min en minarse no serán encontradas |
| **TPS** | Se calcula como `txsExitosas / duracionTotal` (conservador — puede ser menor al TPS pico real) |
| **out_of_gas vs revert** | Los recibos no distinguen ambos tipos de fallo; `out_of_gas_transactions` se reporta como 0 |
| **Modo ERC20/ERC721** | El recolector funciona igual que en EOA; si el contrato tiene logs de revert, no se parsean |

### 24.6 Nuevo valor del campo `fuente` en la respuesta API

```json
// POST /audit/run — respuesta con recolector activado
{
  "code": "OK",
  "message": "Evaluación completada · Ejecución directa con pandoras-box (recibos recolectados por backend). ID: <uuid>",
  "fuente": "pandoras-box-recovery",
  "advertencia": null,
  "data": { ... }
}
```

Los tres valores posibles de `fuente`:

| Valor | Significado |
|---|---|
| `"pandoras-box"` | pandoras-box ejecutó y recopiló los recibos sin errores |
| `"pandoras-box-recovery"` | pandoras-box envió las txs pero falló al recolectar; el backend completó la recolección |
| `"simulacion"` | No hay mnemonic, pandoras-box no está instalado, o falló sin llegar a enviar txs |

