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
  -b    20           \   # tamaño de lote JSON-RPC
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
| 🟢 Verde | `latenciaPromedioMs ≤ 3 000` | Confirmación rápida |
| 🟡 Amarillo | `latenciaPromedioMs ≤ 8 000` | Latencia tolerable para procesos no interactivos |
| 🔴 Rojo | `latenciaPromedioMs > 8 000` | Demasiado lenta para urgencias |

> En Sepolia (~12 s/bloque) la latencia estimada es ~13 800 ms → **siempre rojo** por diseño de la red, no por defecto de la DApp.

### 8.3 Seguridad (tasa de éxito)

| Estado | Condición | Significado |
|---|---|---|
| 🟢 Verde | `tasaExito ≥ 95 %` | El nodo procesa la carga sin errores significativos |
| 🟡 Amarillo | `tasaExito ≥ 80 %` | Nivel de fallos aceptable en estrés |
| 🔴 Rojo | `tasaExito < 80 %` | Alta tasa de reverts o out-of-gas |

### 8.4 Interoperabilidad ERC

| Estado | Condición | Significado |
|---|---|---|
| 🟢 Verde | Deploy OK + llamadas ≥ 95 % | Contrato operable de forma confiable |
| 🟡 Amarillo | Deploy OK sin llamadas medidas, o modo EOA | Parcialmente verificado |
| 🔴 Rojo | Deploy fallido | El contrato no puede ejecutarse en esta red |

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
  "deployExitoso": true,
  "llamadasERCExitosas": 194,
  "llamadasERCTotal": 200,
  "semaforoEficiencia": "amarillo",
  "semaforoLatencia": "rojo",
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

### GET /audit/metrics/:id
**Requiere:** rol `auditor` o `super_admin`.
Detalle completo incluyendo `blockSamples` y `rawOutput`.

### POST /audit/run
**Requiere:** rol `auditor` o `super_admin`.

```jsonc
{
  "rpcUrl": "https://eth-sepolia.g.alchemy.com/v2/<KEY>",
  "modo": "EOA",                 // "EOA" | "ERC20" | "ERC721"
  "totalTransacciones": 100,
  "numSubcuentas": 5,
  "mnemonic": "word1 … word12",  // opcional pero necesario para ejecución real
  "batchSize": 20,               // opcional, default 20
  "contractAddress": "0x...",    // opcional, solo ERC20/ERC721
  "umbralTpsVerde": 10,          // opcionales: umbrales de semáforos
  "umbralTpsAmarillo": 5,
  "umbralLatenciaVerdeMs": 3000,
  "umbralLatenciaAmarilloMs": 8000,
  "umbralTasaExitoVerde": 95
}
```

**Respuesta exitosa (HTTP 201):**
```json
{
  "code": "OK",
  "message": "Evaluación completada (fuente: pandoras-box). ID: 3f8a...",
  "fuente": "pandoras-box",
  "advertencia": null,
  "data": { }
}
```

Cuando pandoras-box falla pero se usa simulación:
```json
{
  "fuente": "simulacion",
  "advertencia": "pandoras-box falló: Command failed | stderr: Error: insufficient funds for gas"
}
```

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
| `backend/src/audit/auditMetricModel.ts` | Tipos TypeScript: `PandorasBoxOutput`, `AuditMetricRecord`, `AuditRunConfig`, `UMBRALES_DEFAULT` |
| `backend/src/audit/pandorasBoxAdapter.ts` | Ejecución real de pandoras-box + fallback simulación; función `ejecutarPrueba(config)` |
| `backend/src/audit/auditMetricsService.ts` | Capa de servicio: `listarMetricas()`, `obtenerMetricaPorId(id)`, `ejecutarEvaluacion(config)` |
| `backend/src/routes/audit.ts` | Router Express con los tres endpoints REST |
| `backend/src/server.ts` | Registro del router en `app.use("/audit", auditRouter)` |
| `backend/data/audit-metrics.json` | Persistencia JSON (generado en runtime) |

### Frontend

| Archivo | Responsabilidad |
|---|---|
| `frontend/src/pages/AuditoriaDashboardPage.tsx` | Página principal RF10: Sección A (estrés de red) + Sección B (interoperabilidad clínica HU0-HU5) |
| `frontend/src/shared/services/api.ts` | Tipos `AuditMetricResumen`, `AuditMetricDetalle`, `AuditRunConfigFrontend`; funciones `listarAuditMetricas()`, `obtenerAuditMetrica()`, `ejecutarAuditRun()` |
| `frontend/src/app/router.tsx` | Ruta `/auditoria/metricas` con guard `evaluacion.consultar` |

---

## 15. Estado de cumplimiento del RF10

| Entregable | Estado |
|---|---|
| Endpoints REST (`GET /audit/metrics`, `GET /audit/metrics/:id`, `POST /audit/run`) | ✅ Operativos |
| Integración real con pandoras-box (flags `-url`, `-m`, `-t`, `-s`, `--mode`, `-o`) | ✅ Corregido |
| Diagnóstico de error cuando pandoras-box falla (campo `advertencia`) | ✅ Implementado |
| Simulación realista con datos del nodo RPC como fallback | ✅ Implementado |
| Métricas de seguridad (reverts, out-of-gas, respuesta del nodo) | ✅ Implementado |
| Módulo de interoperabilidad (chainId, rpcUrl, deploy ERC, llamadas ERC) | ✅ Implementado |
| Vista del auditor: tabla + semáforos + detalle expandible + gráficas SVG | ✅ Implementado |
| Sección B — interoperabilidad clínica (HU0-HU5) embebida en misma página | ✅ Implementado |
| Build sin errores (`npm run build` en backend y frontend) | ✅ Confirmado |
