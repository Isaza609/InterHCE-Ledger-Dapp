# Analisis Tecnico de Pandoras-Box - InterHCE Ledger

## 1. Arquitectura interna de pandoras-box

El componente vendorizado `backend/vendor/pandoras-box/bin/` no es un modulo de medicion academica en sentido estricto, sino un motor de **generacion de carga**, **firma**, **envio concurrente** y **recoleccion basica** de resultados. En la arquitectura actual del proyecto, esa pieza convive con un segundo nivel implementado en `backend/src/audit/pandorasRealMetricsRunner.ts`, cuya responsabilidad es medir formalmente la corrida a nivel de transaccion.

### 1.1 Inventario de `backend/vendor/pandoras-box/bin/`

| Ruta | Rol tecnico |
|---|---|
| `index.js` | Punto de entrada CLI. Resuelve opciones, selecciona modo, distribuye fondos, ejecuta el runtime y llama al recolector. |
| `index.d.ts` | Declaraciones de tipos del entrypoint. No participa en ejecucion. |
| `contracts/ZexCoinERC20.json` | ABI + bytecode del contrato ERC20 de prueba. |
| `contracts/ZexNFTs.json` | ABI + bytecode del contrato ERC721 de prueba. |
| `distributor/distributor.js` | Fondeo de ETH a subcuentas derivadas del mnemonic. |
| `distributor/distributor.d.ts` | Declaraciones de tipos del distribuidor de ETH. |
| `distributor/errors.js` | Errores del subsistema de distribucion. |
| `distributor/errors.d.ts` | Declaraciones de tipos de errores de distribucion. |
| `distributor/tokenDistributor.js` | Fondeo de tokens ERC20 a las subcuentas listas. |
| `distributor/tokenDistributor.d.ts` | Declaraciones de tipos del distribuidor de tokens. |
| `logger/logger.js` | Logging de progreso y errores. |
| `logger/logger.d.ts` | Declaraciones de tipos del logger. |
| `outputter/outputter.js` | Serializacion del JSON nativo de salida de Pandora. |
| `outputter/outputter.d.ts` | Declaraciones de tipos del outputter. |
| `runtime/batcher.js` | Envio batch de `eth_sendRawTransaction`. |
| `runtime/batcher.d.ts` | Declaraciones de tipos del batcher. |
| `runtime/engine.js` | Orquestacion general: signer -> runtime -> batcher. |
| `runtime/engine.d.ts` | Declaraciones de tipos del engine. |
| `runtime/eoa.js` | Runtime de transferencias nativas EOA -> EOA. |
| `runtime/eoa.d.ts` | Declaraciones de tipos del runtime EOA. |
| `runtime/erc20.js` | Runtime ERC20: deploy + `transfer()`. |
| `runtime/erc20.d.ts` | Declaraciones de tipos del runtime ERC20. |
| `runtime/erc721.js` | Runtime ERC721: deploy + `createNFT()`. |
| `runtime/erc721.d.ts` | Declaraciones de tipos del runtime ERC721. |
| `runtime/errors.js` | Errores comunes de runtimes. |
| `runtime/errors.d.ts` | Declaraciones de tipos de errores de runtime. |
| `runtime/runtimes.js` | Enumeracion de modos soportados. |
| `runtime/runtimes.d.ts` | Declaraciones de tipos de modos. |
| `runtime/signer.js` | Obtencion de nonces y firma de transacciones por subcuenta. |
| `runtime/signer.d.ts` | Declaraciones de tipos del signer. |
| `stats/collector.js` | Recoleccion de receipts, bloques y TPS agregado de Pandora. |
| `stats/collector.d.ts` | Declaraciones de tipos del collector. |

Los archivos `*.d.ts` son declarativos y no alteran la semantica de la corrida. La logica sustantiva vive en `index.js`, `distributor/*.js`, `runtime/*.js`, `stats/collector.js` y `outputter/outputter.js`.

### 1.2 Flujo completo: fondeo -> construccion -> firma -> envio -> recoleccion

El flujo real de pandoras-box, segun `backend/vendor/pandoras-box/bin/index.js`, es el siguiente:

1. **Resolucion de parametros.** La CLI fija por defecto `subAccounts = 10`, `transactions = 2000`, `mode = EOA` y `batch = 20`.
2. **Seleccion del runtime.** Se instancia `EOARuntime`, `ERC20Runtime` o `ERC721Runtime`.
3. **Inicializacion del contrato, si aplica.** En ERC20 y ERC721 se ejecuta `Initialize()`, que despliega el contrato desde la cuenta indice `0` del mnemonic.
4. **Distribucion de ETH.** `Distributor.distribute()` fondea las subcuentas `m/44'/60'/0'/0/1..N` desde la cuenta principal `m/44'/60'/0'/0/0`.
5. **Distribucion de tokens, si aplica.** Solo en ERC20, `TokenDistributor.distributeTokens()` reparte saldo del token a las subcuentas listas.
6. **Construccion de transacciones.** Cada runtime genera la carga concreta:
   - EOA: transferencias nativas.
   - ERC20: `transfer()`.
   - ERC721: `createNFT()`.
7. **Firma.** `runtime/signer.js` consulta el nonce inicial de cada subcuenta y firma localmente cada transaccion.
8. **Envio.** `runtime/batcher.js` emite lotes JSON-RPC de `eth_sendRawTransaction`.
9. **Recoleccion.** `stats/collector.js` consulta receipts, bloques y calcula el `TPS` agregado de Pandora.
10. **Salida JSON.** `outputter/outputter.js` persiste el archivo final con `averageTPS` y `blocks`.

En el proyecto InterHCE Ledger, este flujo se reutiliza, pero **no se toma su salida JSON como fuente de verdad metrica**. La funcion `ejecutarPrueba()` de `backend/src/audit/pandorasBoxAdapter.ts` delega primero en `tryRunPandorasMeasured()`, que usa Pandora para ejecutar la carga y luego mide la corrida a nivel tx-level.

### 1.3 Papel exacto de cada archivo clave

#### `outputter/outputter.js`

Su funcion es puramente de serializacion. No calcula ni corrige metricas. Convierte `CollectorData` en el siguiente JSON:

```json
{
  "averageTPS": 8,
  "blocks": [
    {
      "blockNum": 7924130,
      "createdAt": 1718000100,
      "numTxs": 12,
      "gasUsed": "0x52080",
      "gasLimit": "0x1c9c380",
      "gasUtilization": 1.17
    }
  ]
}
```

Por tanto, los **unicos datos reales exportados directamente por Pandora** son:

| Campo | Procedencia |
|---|---|
| `averageTPS` | Calculado por `stats/collector.js` |
| `blocks[].blockNum` | `provider.getBlock()` |
| `blocks[].createdAt` | `block.timestamp` |
| `blocks[].numTxs` | `block.transactions.length` del bloque completo |
| `blocks[].gasUsed` | `block.gasUsed` |
| `blocks[].gasLimit` | `block.gasLimit` |
| `blocks[].gasUtilization` | `block.gasUsed / block.gasLimit` |

No exporta `txHash`, `sentAt`, `receipt.status`, `receipt.gasUsed`, `effectiveGasPrice`, eventos ni estado final.

#### `stats/collector.js`

Es el modulo que realmente determina la semantica del JSON de Pandora.

1. **Receipts.** Primero intenta `eth_getTransactionReceipt` por lotes. Si faltan receipts, usa `provider.waitForTransaction(txHash, 1, receiptTimeoutMs)` con timeout por defecto de `180000 ms`.
2. **Receipts fallidos.** Si encuentra `receipt.status == 0`, lanza una excepcion. Es decir, Pandora no conserva una taxonomia rica de fallos en su JSON; aborta.
3. **Bloques.** Para cada receipt exitoso obtiene el bloque y guarda informacion agregada del bloque completo.
4. **TPS.** Calcula `TPS` sobre transacciones propias confirmadas, pero usando intervalos de bloque y redondeo entero superior.

La formula real del codigo es:

```text
totalTxs = numero de tx de la prueba con block != 0
uniqueBlocks = conjunto de bloques que contienen esas tx
totalTime = sumatorio, para cada bloque unico, de
            round(abs(timestamp(bloque_actual) - timestamp(bloque_padre)))
TPS_Pandora = ceil(totalTxs / totalTime)
```

Esto implica cuatro consecuencias metodologicas:

1. **No es latencia por transaccion.** El collector no registra `sentAt`.
2. **No es gas por transaccion.** El gas exportado es `block.gasUsed`, no `receipt.gasUsed`.
3. **`numTxs` mezcla tx ajenas.** Usa `block.transactions.length`, por lo que combina transacciones de la prueba con transacciones de terceros dentro del mismo bloque.
4. **El redondeo `ceil` distorsiona muestras pequenas.** Por ejemplo, una corrida de 34 tx confirmadas en 24 s puede quedar en `1` o `2` segun el metodo, aun cuando el valor real sea `1.4167`.

#### `pandorasBoxAdapter.ts`

Este archivo contiene **dos capas historicas diferentes**:

| Ruta logica | Estado actual | Funcion |
|---|---|---|
| `parsearSalidaReal()` | Historica | Convierte el JSON nativo de Pandora en un `PandorasBoxOutput` usando varias heuristicas. |
| `ejecutarPrueba()` + `tryRunPandorasMeasured()` | Vigente | Ejecuta Pandora como generador de carga y mide la corrida con receipts, bloques, eventos y estado real. |

La distincion es central:

- **`parsearSalidaReal()`** no mide latencia ni gas por tx; reconstruye esos campos a partir del bloque.
- **`tryRunPandorasMeasured()`** registra `txHash`, `sentAt`, `receipt`, `block.timestamp`, `receipt.gasUsed`, `receipt.status` y validaciones de interoperabilidad.

En otras palabras, el adaptador ya no usa a Pandora como fuente de verdad metrica, sino como backend de ejecucion.

## 2. Metricas: que es real vs que es heuristico

### 2.1 Tabla de fuentes metricas

| Metrica | Fuente original de Pandora | Limitacion | Fuente vigente del proyecto |
|---|---|---|---|
| TPS promedio | `averageTPS` calculado por `collector.js` | Usa ventanas de bloque y `ceil`; no refleja necesariamente la ventana real `minTs -> maxTs` | `confirmedTxs.length / buildRealTpsWindowSeconds(...)` |
| TPS pico | No existe en JSON nativo | Si se deriva del bloque, queda sesgado por tx ajenas | `max(blockSamples[].tps)` sobre tx propias |
| Latencia | No existe | El adaptador historico la aproximaba con blocktime | `block.timestamp - sentAt` por tx |
| Gas por transaccion | No existe | `gasUsed` nativo es de bloque, no de tx | `receipt.gasUsed` |
| Tasa de exito | Parcial | Pandora aborta ante `status == 0` y no clasifica fallos de envio | `receipt.status` + `failed_send` + `receipt_timeout` |
| Seguridad | Parcial | No distingue `replacement_underpriced`, `rate_limit`, `rpc_transport`, etc. | `error_breakdown` y `tx_metrics` |
| Interoperabilidad | No existe | No valida eventos ni estado | `event_valid`, `state_valid`, `interoperability_checks` |

### 2.2 Que campos eran reales en Pandora y cuales eran heuristica del adaptador historico

| Campo final en `PandorasBoxOutput` | Origen en la ruta historica |
|---|---|
| `tps_average` | Real de Pandora: `raw.averageTPS` |
| `block_samples[].block_number` | Real de Pandora: `raw.blocks[].blockNum` |
| `block_samples[].timestamp` | Real de Pandora: `raw.blocks[].createdAt` |
| `block_samples[].gas_limit` | Real de Pandora: `raw.blocks[].gasLimit` |
| `gas_utilization_pct` | Real de Pandora: promedio de `raw.blocks[].gasUtilization` |
| `successful_transactions` | Heuristica: `min(totalSolicitado, sum(block.numTxs))` |
| `failed_transactions` | Heuristica: `totalSolicitado - successful_transactions` |
| `tps_peak` | Heuristica: `max(block.numTxs / deltaBlockTime)` |
| `latency_avg_ms` | Heuristica: `avgBlockTimeSec * 1000 * 1.15` |
| `latency_min_ms` | Heuristica: `minBlockTimeSec * 1000 * 0.9` |
| `latency_max_ms` | Heuristica: `maxBlockTimeSec * 1000 * 2.5` |
| `latency_p95_ms` | Heuristica: `latency_avg_ms * 1.6` |
| `latency_p99_ms` | Heuristica: `latency_avg_ms * 2.1` |
| `gas_used_avg` | Agregado de bloque: promedio de `block.gasUsed` |
| `gas_used_max` | Agregado de bloque: maximo de `block.gasUsed` |
| `reverted_transactions` | Heuristica: `round(fallidas * 0.7)` |
| `out_of_gas_transactions` | Heuristica: `round(fallidas * 0.3)` |
| `node_response_avg_ms` | Heuristica: `avgBlockTimeSec * 80` |
| `deploy_successful` | Heuristica: ratio de fallos < 50 % |
| `erc_function_calls`, `erc_function_success` | Heuristica: igual a tx exitosas |

### 2.3 Definiciones formales vigentes

La implementacion vigente del proyecto redefine las metricas asi:

```text
TPS real promedio = transacciones_propias_confirmadas / ventana_real_de_confirmacion
latencia_tx       = block.timestamp_confirmacion - sentAt
gas_tx            = receipt.gasUsed
seguridad_tx      = receipt.status + errores_reales_de_envio/timeout/ejecucion
interoperabilidad = evento_esperado_valido AND estado_final_valido
```

### 2.4 Evidencia empirica de la diferencia entre bloque y tx-level

El historial local de `backend/data/audit-metrics.json` muestra con claridad la diferencia entre ambas capas:

| Corrida | Modo | `gas_used_avg` observado | Interpretacion correcta |
|---|---|---|---|
| `2026-04-02T17:30:22.676Z` | EOA | `26583807` | Valor imposible como gas por tx EOA; corresponde a gas agregado de bloque. |
| `2026-04-02T18:51:42.309Z` | EOA | `21000` | Valor coherente con `receipt.gasUsed` real para transferencia nativa. |
| `2026-04-02T19:09:30.940Z` | ERC20 | `35250` | Valor coherente con `receipt.gasUsed` de `transfer()`. |
| `2026-04-02T17:35:52.873Z` | ERC721 | `23608563.666...` | Valor agregado de bloque de una corrida anterior al tx-level runner. |

Por tanto, los registros historicos con gas promedio en decenas de millones no deben reportarse como gas por transaccion en la monografia.

Existe una segunda señal de alerta igual de importante: algunos registros antiguos llegaron a persistir valores como `successful_transactions = 506` para una corrida configurada con `total_transactions = 100`. Ese patron no describe mayor rendimiento real; describe **mezcla de transacciones propias con todas las transacciones del bloque** en una etapa previa de parseo heuristico.

## 3. Analisis por modo

### 3.1 EOA

#### Que transacciones genera exactamente

El runtime `runtime/eoa.js` genera **transferencias nativas de ETH** entre subcuentas derivadas del mismo mnemonic:

- `value = 0.0001` ETH por transaccion.
- El emisor rota como `accounts[i % accounts.length]`.
- El receptor rota como `accounts[(i + 1) % accounts.length]`.
- No despliega contrato.
- No emite eventos de contrato.

En el proyecto actual, las corridas tx-level exitosas observadas usaron **3 subcuentas activas**: `0x2689930Aa537859D3753D8825E97b3994616a91B`, `0x3782bbc2EF5707Fe96f9Ff70d43296335c1d12c0` y `0x6D7A79dDEC4E517EC70919D2c711798f0738d218`.

#### Por que frecuentemente tiene fallos

La evidencia local no apunta a falta de gas ni a falta de fondos. Los fallos observados fueron:

| Corrida | Resultado | Causa observada |
|---|---|---|
| `2026-04-02T19:16:23.232Z` | `34/50` exitosas, `TPS = 1.4167` | `15 receipt_timeout` + `1 failed_send` con mensaje `future transaction tries to replace pending` |
| `2026-04-02T19:41:48.983Z` | `35/50` exitosas, `TPS = 2.9167` | `13 replacement_underpriced` + `2 receipt_timeout` |

En consecuencia, la causa raiz observada para EOA es:

1. **Cola de nonces/pending transactions** en las mismas subcuentas.
2. **Reejecucion sobre cuentas con tx aun pendientes**, lo que dispara `replacement transaction underpriced`.
3. **Timeout de receipts** antes de que la red confirme todas las tx dentro de la ventana de `180 s`.

No encontre evidencia local de `out_of_gas` ni de `revert` en EOA.

#### Visibilidad en Sepolia Etherscan

Las transacciones de workload EOA son visibles **desde las subcuentas**, no desde la direccion principal. La cuenta principal `0x580E296fbC145bfCB2A33891FCb7e116392c4dD6` aparece sobre todo como:

- cuenta financiadora de subcuentas;
- cuenta origen del fondeo inicial;
- cuenta que despliega contratos en ERC20/ERC721.

Por eso, si se inspecciona solo la wallet principal, puede parecer que el modo EOA "no genero" las transferencias del benchmark, cuando en realidad estas viven en los historiales de las subcuentas emisoras.

#### Por que ERC20 suele verse mas facil que EOA

ERC20 deja varias huellas adicionales:

1. **Deploy del contrato** desde la cuenta principal.
2. **Distribucion de tokens** desde la cuenta principal a subcuentas.
3. **Llamadas al contrato** desde subcuentas.
4. **Eventos `Transfer`** indexables por el explorer.

EOA, en cambio, solo deja:

1. fondeo desde la principal; y
2. transferencias nativas entre subcuentas.

Por ello, ERC20 resulta mas visible en Etherscan y en el contrato mismo, mientras que EOA exige revisar directamente las subcuentas.

### 3.2 ERC20

#### Que pasos hace internamente

El runtime `runtime/erc20.js` ejecuta el siguiente pipeline:

1. **Deploy** del contrato `Zex Coin (ZEX)` desde la cuenta indice `0`.
2. **Distribucion de ETH** a subcuentas mediante `Distributor`.
3. **Distribucion de tokens** a subcuentas mediante `TokenDistributor`.
4. **Construccion de llamadas `transfer()`** entre subcuentas.
5. **Firma y envio batch** via `eth_sendRawTransaction`.
6. **Recoleccion tx-level** en el runner del proyecto.

No forma parte del workload estandar:

- `approve()`;
- `transferFrom()`.

La capa de medicion externa si puede **reconocer** `approve()` si apareciera, pero Pandora no la genera en este proyecto.

#### Eventos que genera en la red

En la ejecucion normal del modo ERC20 se observan eventos:

- `Transfer` durante el fondeo inicial de tokens a subcuentas.
- `Transfer` durante cada `transfer()` del benchmark.

El ABI tambien soporta `Approval`, pero el workload base no lo emite porque no llama `approve()`.

#### Por que tambien tiene fallos a veces

La corrida `2026-04-02T19:23:51.252Z` muestra:

- `34/50` transacciones exitosas;
- `16 receipt_timeout`;
- `TPS real = 1.4167`;
- `gas_used_avg = 35250`.

No hubo `revert`, `out_of_gas` ni `rate_limit` en esa corrida. La causa observada fue nuevamente la **no obtencion del receipt dentro del timeout**, no un fallo funcional del contrato.

La corrida `2026-04-02T19:09:30.940Z` muestra el caso estable:

- `30/30` exitosas;
- `TPS real = 1.25`;
- `gas_used_avg = 35250`;
- `event_checks_ok = 30`;
- `state_checks_ok = 30`;
- `unsupported_operations = [ERC20_APPROVE]`.

Esto confirma que, cuando la red responde dentro de la ventana de medicion, el modo ERC20 se comporta correctamente y la interoperabilidad si puede validarse formalmente.

### 3.3 ERC721

#### Que pasos hace internamente

El runtime `runtime/erc721.js` ejecuta el siguiente flujo:

1. **Deploy** del contrato NFT `ZEXTokens` desde la cuenta indice `0`.
2. **Distribucion de ETH** a subcuentas.
3. **Construccion de llamadas `createNFT(this.nftURL)`** desde subcuentas.
4. **Firma y envio** en batches.
5. **Recoleccion** posterior.

No forma parte del workload estandar:

- `transferFrom()`;
- `safeTransferFrom()`.

La capa externa puede validarlas si aparecieran, pero Pandora no las emite en esta configuracion.

#### Por que consume mas gas que los otros modos

ERC721 es el modo mas costoso porque cada `createNFT()`:

1. crea un token nuevo;
2. escribe estado nuevo de ownership;
3. actualiza contadores y storage del contrato;
4. emite el evento `Transfer` desde la direccion cero al minter.

En terminos relativos:

| Modo | Unidad dominante de trabajo |
|---|---|
| EOA | transferencia nativa simple |
| ERC20 | actualizacion de balances fungibles + evento |
| ERC721 | alta de activo no fungible + ownership + metadata + evento |

#### Eventos que genera en la red

La operacion normal de benchmark ERC721 genera el evento:

- `Transfer(address(0), minter, tokenId)` en cada mint.

El ABI tambien expone `Approval` y `ApprovalForAll`, pero no forman parte del workload base.

#### Estado de la evidencia local reciente

El historial local conserva corridas ERC721 reales anteriores, por ejemplo `2026-04-02T17:35:52.873Z`, con:

- `50/50` exitosas;
- `TPS promedio = 2`;
- `3` bloques observados;
- `deploy_successful = true`.

Sin embargo, ese registro pertenece a una etapa previa donde el `gas_used_avg` seguia siendo agregado de bloque y aun no se preservaban `tx_metrics` completos para ERC721. Por tanto:

- la **semantica funcional del modo ERC721** si puede reconstruirse completamente desde el codigo;
- pero para **latencia y gas por tx** de ERC721 solo deben citarse corridas nuevas con runner tx-level.

No encontre en el historial local una corrida reciente ERC721 con `tx_metrics` completos equivalente a las corridas tx-level ya disponibles para EOA y ERC20.

### 3.4 Verificacion en Sepolia

La verificacion directa sobre Sepolia, usando el mnemonic configurado en `backend/.env`, devolvio los siguientes valores de `getTransactionCount()` y balance actual:

| Indice derivado | Direccion | Rol practico | Tx enviadas | Balance ETH |
|---|---|---|---:|---:|
| `0` | `0x580E296fbC145bfCB2A33891FCb7e116392c4dD6` | Cuenta principal, fondeo y deploy | `416` | `0.462942922750971052` |
| `1` | `0x2689930Aa537859D3753D8825E97b3994616a91B` | Subcuenta activa en workload | `2128` | `0.050533786262316772` |
| `2` | `0x3782bbc2EF5707Fe96f9Ff70d43296335c1d12c0` | Subcuenta activa en workload | `2099` | `0.050680587380567651` |
| `3` | `0x6D7A79dDEC4E517EC70919D2c711798f0738d218` | Subcuenta activa en workload | `2106` | `0.048807993932155074` |
| `4` | `0x193D8080a7d1fe016711856E2451E7cE6f1de0d9` | Subcuenta derivada adicional | `1824` | `0.049707055489701307` |

Observaciones:

1. El conteo devuelto por `getTransactionCount()` corresponde al **nonce confirmado** de salida, no al total de movimientos listados por el explorer.
2. Las tres subcuentas activas del proyecto actual coinciden con las direcciones que aparecen en las corridas tx-level exitosas y fallidas.
3. Los balances actuales descartan, para las corridas analizadas, una hipotesis de **fondos insuficientes** como causa principal de los fallos recientes.

## 4. Causas raiz de resultados bajos

### 4.1 Causas exactas de transacciones fallidas por modo

| Modo | Evidencia observada | Causa raiz confirmada | Observacion |
|---|---|---|---|
| EOA | `2026-04-02T19:16:23.232Z`: `15 receipt_timeout` + `1 future transaction tries to replace pending` | Pendientes no confirmadas dentro del timeout y conflicto de mempool/nonce | No hubo `out_of_gas` ni `revert` |
| EOA | `2026-04-02T19:41:48.983Z`: `13 replacement_underpriced` + `2 receipt_timeout` | Reejecucion sobre cuentas con tx pendientes y politica de reemplazo del nodo | Error de precio/reemplazo, no de contrato |
| ERC20 | `2026-04-02T19:23:51.252Z`: `16 receipt_timeout` | Backlog de confirmacion; receipts no llegaron dentro de `180 s` | No hubo `revert` ni `out_of_gas` |
| ERC721 | No hay corrida tx-level fallida reciente persistida | No hay evidencia local suficiente para afirmar un patron especifico distinto | Por codigo, comparte riesgo de timeout y saturacion de envio; falta de fondos abortaria la corrida completa |

La pregunta "nonce, gas, rate limit o fondos" se responde asi, con rigor:

- **Nonce / pending mempool:** si, es causa observada.
- **Gas insuficiente:** no hay evidencia local reciente de que sea la causa dominante.
- **Rate limit de Alchemy:** el codigo lo contempla, pero en las corridas fallidas inspeccionadas no aparecio `rate_limit`.
- **Fondos insuficientes:** si ocurre, normalmente impide iniciar la corrida; no aparece como `failed_transactions` parciales dentro de una corrida exitosa.

### 4.2 Por que con 50 tx el TPS es ~1.4 y con 100 tx es ~2.8

Esto no es un bug aritmetico; es la combinacion de:

1. **ventanas cortas de Sepolia** de aproximadamente `12 s` por bloque;
2. **pocos bloques observados**;
3. **solo 3 subcuentas activas**;
4. **muestras parcialmente confirmadas** en las corridas con timeout.

Ejemplo observado:

| Corrida | Confirmadas | Ventana real | TPS real |
|---|---:|---:|---:|
| EOA `2026-04-02T19:16:23.232Z` | `34` | `24 s` | `34 / 24 = 1.4167` |
| EOA `2026-04-02T18:51:42.309Z` | `100` | `36 s` | `100 / 36 = 2.7778` |

El primer caso no solo tiene menos transacciones solicitadas; ademas confirma menos transacciones efectivas. En consecuencia, el TPS baja por **menos tx confirmadas en una ventana de bloques similar**, no por un error del calculo.

### 4.3 Numero de subcuentas por defecto

Hay que distinguir dos defaults:

| Contexto | Valor por defecto | Aplica a |
|---|---:|---|
| Pandora CLI original (`index.js`) | `10` | EOA, ERC20 y ERC721 |
| Proyecto InterHCE (`pandorasBoxAdapter.ts`) | `3` | EOA, ERC20 y ERC721 |

Por tanto, en el proyecto actual el benchmark corre, salvo override explicito, con **3 subcuentas** en todos los modos.

### 4.4 El numero de subcuentas si afecta el TPS

Si. La razon tecnica es directa:

1. `Signer.getSenderAccounts()` obtiene un nonce independiente por cuenta.
2. Los runtimes distribuyen la carga usando `senderIndex = i % accounts.length`.
3. Cada cuenta abre una "linea" de nonces propia.

Con mas subcuentas:

- aumenta el paralelismo potencial;
- disminuye la serializacion estricta sobre una sola secuencia de nonce;
- pero aumenta el costo de fondeo, el numero de emisores concurrentes y la presion sobre el RPC.

Existe ademas un detalle importante del distribuidor de Pandora: el fondeo de ETH es conservador y calcula el costo por subcuenta como `totalTx * baseTxCost`, no como la fraccion real de tx que esa subcuenta emitira. Eso hace que subir el numero de subcuentas incremente rapidamente el costo total previo a la corrida.

### 4.5 Que pasa si se aumenta el numero de subcuentas

El efecto esperado es mixto:

| Efecto | Consecuencia |
|---|---|
| Mas emisores concurrentes | Puede mejorar el throughput si el RPC y la red absorben la carga |
| Mas fondeo previo | Mas transacciones de preparacion desde la cuenta principal |
| Mas presion sobre mempool y RPC | Mayor probabilidad de `replacement_underpriced`, `unknown_send` o `rate_limit` |
| Mayor dispersion operativa | Mas direcciones que revisar en el explorer y mas estado a validar |

En Sepolia con Alchemy, subir subcuentas sin ampliar timeout ni revisar los pendientes puede empeorar la estabilidad.

### 4.6 Configuracion que mejora el TPS sin cambiar arquitectura

Si hay palancas operativas utiles:

| Parametro | Valor actual relevante | Efecto esperado |
|---|---|---|
| `batchSize` | `10` en el proyecto | Mantiene un compromiso razonable entre paralelismo y rechazo del RPC |
| `batchDelayMs` | `5000 ms` para Alchemy | Reduce saturacion del proveedor |
| `receiptTimeoutMs` | `180000 ms` | Reduce falsos negativos por confirmacion tardia |
| `receiptPollIntervalMs` | `2000 ms` en Alchemy | Evita polling agresivo |
| Espera entre pruebas | no automatizada | Reduce conflictos por nonces pendientes entre corridas |

La mejora mas inmediata, sin redisenar el modulo, es:

1. no relanzar una prueba sobre las mismas subcuentas mientras existan pendientes;
2. mantener `batchSize = 10` con Alchemy;
3. conservar `3` subcuentas como baseline estable;
4. aumentar el timeout cuando aparezcan `receipt_timeout` recurrentes;
5. usar un RPC con mayor capacidad si se quiere aumentar paralelismo real.

### 4.7 Sobre el rate limit de Alchemy

El proyecto ya incorpora defensas especificas:

- clasificacion de `rate_limit` en `classifySendError()`;
- `batchDelayMs = 5000 ms` por defecto cuando la URL es de Alchemy.

Sin embargo, en las corridas fallidas concretas inspeccionadas en este analisis **no aparecio `rate_limit`**. Por tanto, para el conjunto de evidencia local disponible, el problema dominante no fue 429/CU exhaustion sino **timeout de receipts** y **errores de reemplazo sobre tx pendientes**.

## 5. Configuracion optima recomendada

Las recomendaciones siguientes no modifican la arquitectura; solo estabilizan el regimen experimental.

### 5.1 Parametros operativos recomendados

| Parametro | EOA | ERC20 | ERC721 | Justificacion |
|---|---:|---:|---:|---|
| `numSubcuentas` | `3` | `3` | `3` | Coincide con el default seguro del proyecto y con las corridas tx-level estables ya observadas |
| `batchSize` | `10` | `10` | `10` | Es el valor ya ajustado para Alchemy |
| `batchDelayMs` | `5000 ms` | `5000 ms` | `5000 ms` | Reduce saturacion de envio batch en Alchemy |
| `receiptTimeoutMs` | `180000-240000 ms` | `180000-240000 ms` | `240000-300000 ms` | ERC721 puede tardar mas en estabilizarse por mayor costo y dispersion en bloques |

### 5.2 Tiempo de espera entre pruebas

Recomendacion operativa:

| Escenario | Espera minima recomendada |
|---|---|
| Corrida estable, sin timeouts | `>= 60 s` |
| Corrida con `receipt_timeout` | `>= 180 s` o hasta confirmar que no queden pendientes |
| Corrida con `replacement_underpriced` | No relanzar hasta que se vacie la cola pendiente de la subcuenta afectada |

La razon es simple: una segunda corrida sobre cuentas con nonces aun pendientes hereda el estado problemático de la primera.

### 5.3 Tamano minimo de muestra para resultados estables

| Objetivo | Recomendacion |
|---|---|
| Smoke test funcional | `30-50 tx` |
| Comparacion formal entre modos | `>= 100 tx` |
| Serie mas estable para monografia | `100-200 tx` y `>= 3 bloques observados` |

Las muestras de `30-50 tx` son utiles para verificar funcionamiento, pero demasiado sensibles al azar del block scheduling de Sepolia para convertirse en evidencia principal de rendimiento comparado.

### 5.4 Ejemplos observados que respaldan la recomendacion

| Corrida | Modo | Tx solicitadas | Exitosas | Fallidas | TPS real/promedio | Lectura |
|---|---|---:|---:|---:|---:|---|
| `2026-04-02T18:51:42.309Z` | EOA | `100` | `100` | `0` | `2.7778` | Caso estable, tres subcuentas, sin errores |
| `2026-04-02T19:09:30.940Z` | ERC20 | `30` | `30` | `0` | `1.25` | Caso estable con validacion de evento y estado |
| `2026-04-02T19:16:23.232Z` | EOA | `50` | `34` | `16` | `1.4167` | Caso degradado por `receipt_timeout` y pending replacement |
| `2026-04-02T19:23:51.252Z` | ERC20 | `50` | `34` | `16` | `1.4167` | Caso degradado por timeout de receipts |

## 6. Interpretacion para la monografia

### 6.1 Que resultados son validos y por que

Son validos para reporte academico:

1. corridas con `fuente = "pandoras-box"` generadas por el runner tx-level actual;
2. resultados sustentados por `tx_metrics`, `error_breakdown`, `measurement_comparison` e `interoperability_checks`;
3. TPS calculado sobre **transacciones propias confirmadas**;
4. gas calculado con `receipt.gasUsed`;
5. latencia calculada como `sentAt -> block.timestamp`.

### 6.2 Como documentar las limitaciones

Las limitaciones deben expresarse explicitamente:

| Limitacion | Forma correcta de documentarla |
|---|---|
| Pandora no mide latencia por tx | "Pandora se utilizo como generador de carga; la latencia oficial se obtuvo de la capa tx-level externa." |
| Pandora mezcla tx propias y ajenas a nivel bloque | "Los agregados por bloque se usaron solo como referencia de contexto, no como fuente de verdad por transaccion." |
| Muestras pequenas en Sepolia | "Los resultados de 30-50 tx se interpretan como pruebas exploratorias, no como evidencia principal." |
| `receipt_timeout` no implica necesariamente `revert` | "Una transaccion clasificada como timeout significa ausencia de receipt dentro de la ventana de medicion, no fallo semantico concluyente." |
| ERC721 sin corrida tx-level reciente persistida | "La semantica funcional del modo ERC721 se reconstruyo desde el codigo; para reportar latencia/gas por tx se requiere corrida tx-level reciente." |

### 6.3 Que metricas pueden reportarse con confianza

| Metrica | Nivel de confianza | Condicion |
|---|---|---|
| TPS promedio real | Alto | Solo en corridas tx-level vigentes |
| Latencia promedio y percentiles | Alto | Solo en corridas con `sentAt` y `block.timestamp` reales |
| Gas por transaccion | Alto | Solo cuando `gas_used_avg` proviene de `receipt.gasUsed` |
| Tasa de exito | Alto | Si se reportan aparte `failed_send`, `receipt_timeout`, `revert` y `out_of_gas` |
| Interoperabilidad ERC20 | Alto | Cuando hay validacion de evento y estado, como en `2026-04-02T19:09:30.940Z` |
| Interoperabilidad ERC721 | Medio | El codigo la soporta, pero el historial local aun no aporta una corrida tx-level reciente equivalente |

### 6.4 Sintesis interpretativa final

Pandoras-box funciona correctamente en este proyecto como **motor de ejecucion de carga** para los tres modos EVM evaluados:

- **EOA**: transferencias nativas entre subcuentas;
- **ERC20**: deploy del contrato, fondeo de tokens y llamadas `transfer()`;
- **ERC721**: deploy del contrato y llamadas `createNFT()`.

No obstante, su JSON nativo solo entrega una perspectiva **agregada por bloque**, insuficiente para una evaluacion monografica rigurosa de TPS real, latencia por tx, gas por tx, seguridad e interoperabilidad. La capa externa implementada en el backend corrige exactamente esa limitacion al reconstruir la corrida desde `txHash`, `receipt`, `block.timestamp`, eventos y estado on-chain.

La conclusion metodologica es inequívoca: para la monografia deben reportarse como resultados oficiales las metricas tx-level del runner externo, y utilizar los agregados de Pandora unicamente como referencia auxiliar de contexto de bloque y de carga ejecutada.
