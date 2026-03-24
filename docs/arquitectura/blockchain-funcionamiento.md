# Como funciona la blockchain en este proyecto

Este documento explica, de forma practica, como se usa la blockchain dentro de InterHCE Ledger, que datos van on-chain, cuales van off-chain y cuando se espera que exista una transaccion real.

## 1. Idea principal

En este proyecto, la blockchain **no** reemplaza la base clinica ni el servidor FHIR.

Su funcion es actuar como una **capa de evidencia y trazabilidad**:

- Certifica que existio un evento relevante.
- Conserva hashes y metadatos no sensibles.
- Permite verificar integridad entre lo almacenado off-chain y lo registrado on-chain.
- Deja una huella auditable para creacion, actualizacion, permisos y consultas relevantes.

La historia clinica completa sigue viviendo fuera de la cadena.

## 2. Que va off-chain

Off-chain debe quedar todo lo necesario para la atencion clinica y la interoperabilidad:

- Documento clinico completo del episodio.
- Recursos FHIR.
- Datos del paciente.
- Diagnosticos, procedimientos, medicamentos y observaciones.
- Informacion sensible o identificable.

En este repositorio, ese almacenamiento lo maneja el backend y puede ir a HAPI FHIR o a memoria para el prototipo.

## 3. Que va on-chain

On-chain solo debe quedar evidencia minima, no el contenido medico completo.

Ejemplos de datos que si deben registrarse:

- `documentHash` del documento clinico.
- `episodeIdHash`.
- `eventIdHash`.
- Version actual del episodio.
- Hash de la IPS origen.
- Hash de la IPS destino cuando hay permisos.
- Eventos de auditoria y trazabilidad.

## 4. Que no debe ir on-chain

No deben registrarse en blockchain:

- Nombre del paciente.
- Numero de identificacion.
- Documento clinico en texto plano.
- Diagnostico completo en texto claro.
- Recursos FHIR completos.
- Cualquier dato que exponga informacion clinica sensible.

## 5. Cuando se genera una transaccion

En este proyecto, una transaccion no ocurre "cada cierto tiempo". Ocurre **cuando hay una accion importante que debe dejar evidencia**.

Las acciones del backend que hoy disparan registro de trazabilidad son:

- `EPISODE_CREATED`: crear episodio.
- `EPISODE_UPDATED`: actualizar episodio.
- `PERMISSION_GRANTED`: otorgar permiso entre IPS.
- `PERMISSION_REVOKED`: revocar permiso entre IPS.
- `AUDITABLE_ACCESS`: consultar documento clinico.
- `INTEGRITY_CHECK`: verificar integridad del episodio.

Eso significa que la blockchain se usa **por evento**, no por cron, no por minuto y no por cada render del frontend.

### Mapa actual de acciones que generan transaccion

| Accion funcional | Ruta o disparador | Evento de trazabilidad | Metodo del contrato | Quien firma |
|---|---|---|---|---|
| Crear episodio | `POST /episodes` | `EPISODE_CREATED` | `registrarEpisodio(...)` | Backend |
| Actualizar episodio | `PUT /episodes/:id` | `EPISODE_UPDATED` | `actualizarEpisodio(...)` | Backend |
| Consultar documento clinico | `GET /episodes/:id/document` | `AUDITABLE_ACCESS` | `registrarTraza(...)` | Backend |
| Otorgar permiso entre IPS | `POST /episodes/:id/permissions/grant` | `PERMISSION_GRANTED` | `registrarPermisoDocumento(...)` | Backend |
| Revocar permiso entre IPS | `POST /episodes/:id/permissions/revoke` | `PERMISSION_REVOKED` | `registrarPermisoDocumento(...)` | Backend |
| Verificar integridad | `GET /episodes/:id/integrity` | `INTEGRITY_CHECK` | `registrarTraza(...)` | Backend |

### Acciones manuales desde wallet

Ademas del flujo automatico del backend, el frontend tiene una utilidad manual en el portal clinico para enviar transacciones directas desde wallet. Estas acciones sirven para contraste o pruebas, no para el flujo principal del producto.

| Accion manual | Pantalla | Accion enviada | Destino on-chain | Quien firma |
|---|---|---|---|---|
| Registrar acceso | Portal clinico | `DOCUMENT_ACCESS` | `fallback` del contrato mediante `eth_sendTransaction` | Wallet del usuario |
| Registrar cambio de permiso | Portal clinico | `PERMISSION_CHANGE` | `fallback` del contrato mediante `eth_sendTransaction` | Wallet del usuario |

### Lo que no genera transaccion por ahora

Actualmente no generan transaccion blockchain:

- `GET /episodes/:id/onchain-metadata`, porque solo prepara metadatos.
- `GET /episodes/:id/traceability`, porque solo consulta historial ya registrado.
- `GET /episodes/:id/versions`, porque solo consulta versiones existentes.
- `GET /episodes/:id/permissions`, porque solo consulta permisos existentes.
- Operaciones de autenticacion, roles, usuarios e infraestructura.

El contrato si tiene capacidad para `gestionarUsuario(...)`, pero ese metodo todavia no esta integrado al flujo del producto.

## 6. Flujo esperado de una operacion clinica

### Crear episodio

1. El frontend envia el formulario al backend.
2. El backend valida la estructura clinica.
3. El backend genera el documento clinico.
4. El backend almacena el documento off-chain.
5. El backend calcula el hash del documento.
6. El backend registra una traza del tipo `EPISODE_CREATED`.
7. Si la integracion real esta activa, el backend envia una transaccion al contrato.
8. La respuesta vuelve con `traceEvent.evidence.transactionHash`.

### Actualizar episodio

1. Se genera una nueva version del documento.
2. Se recalcula el hash.
3. Se registra `EPISODE_UPDATED`.
4. Si blockchain real esta activa, se envia una nueva transaccion.

### Compartir o revocar acceso

1. El backend cambia el estado del permiso.
2. Se registra `PERMISSION_GRANTED` o `PERMISSION_REVOKED`.
3. Si blockchain real esta activa, se envia una transaccion asociada al permiso.

### Consultar documento

1. El backend valida permisos.
2. Recupera el documento off-chain.
3. Registra `AUDITABLE_ACCESS`.
4. Puede quedar evidencia blockchain del acceso, segun configuracion.

### Verificar integridad

1. Se recupera el documento off-chain.
2. Se recalcula el hash.
3. Se compara contra el ultimo hash registrado como evidencia.
4. Se registra `INTEGRITY_CHECK`.

## 7. Quien firma la transaccion

Hay dos caminos distintos en este repositorio:

### A. Flujo principal del producto

En el flujo normal, quien intenta registrar en blockchain es el **backend**, usando:

- una RPC de Sepolia,
- una private key configurada en el servidor,
- la direccion del contrato desplegado.

Por eso el usuario puede usar la app y aun asi no ver una firma manual en MetaMask para cada operacion.

### B. Flujo manual desde wallet

El frontend tambien incluye una utilidad para enviar una traza manual desde wallet en la pagina del portal clinico. Ese flujo sirve para contrastar o probar la integracion directa con Sepolia, pero **no es el flujo principal** del producto.

## 8. Que pasa si blockchain no esta disponible

En la configuracion estricta del proyecto, si falta alguno de estos elementos:

- RPC configurada,
- private key del backend,
- direccion del contrato,

entonces la operacion que requiere evidencia blockchain **debe fallar**.

Eso significa:

- no debe inventarse una transaccion,
- no debe devolverse una evidencia local como reemplazo,
- y la aplicacion debe informar claramente que falta la configuracion de blockchain real.

## 9. Como saber si la evidencia fue real o simulada

Para saberlo, revisa estos campos:

- `traceEvent.evidence.ledgerMode`
- `traceEvent.evidence.transactionHash`
- `traceEvent.evidence.explorerUrl`

Interpretacion:

- Si `ledgerMode` es `real`, la app logro registrar en blockchain.
- Si `explorerUrl` abre una tx valida en Sepolia Etherscan, la transaccion fue real.

Ademas, la pantalla de infraestructura debe mostrar:

- modo blockchain `real`,
- RPC configurada,
- firma configurada,
- contrato disponible.

## 10. Que deberia considerarse una buena politica on-chain

Para este proyecto, una politica razonable seria:

- Registrar on-chain la creacion del episodio.
- Registrar on-chain cada actualizacion/version.
- Registrar on-chain cada otorgamiento o revocacion de permiso.
- Evaluar si cada consulta de documento debe ir on-chain o solo algunas consultas auditables.
- Evaluar si cada chequeo de integridad debe ir on-chain o si basta con mantenerlo como evidencia segun costo.

La regla general es:

**on-chain para eventos importantes de confianza, versionado, permisos e integridad; off-chain para el contenido clinico operativo.**

## 11. Que problema resuelve realmente la blockchain aqui

La blockchain en este proyecto ayuda a responder preguntas como estas:

- "Este episodio si fue creado y no inventado despues?"
- "El documento actual coincide con la ultima huella registrada?"
- "Quedo evidencia de que una IPS compartio o revoco acceso?"
- "Se puede demostrar que hubo una consulta auditable?"

No resuelve por si sola:

- almacenamiento clinico completo,
- busqueda clinica,
- lectura eficiente de documentos,
- control de acceso detallado sin apoyo del backend.

## 12. Resumen corto

La blockchain de InterHCE Ledger debe entenderse como una **notaria tecnica**:

- El dato medico real vive off-chain.
- La cadena guarda huellas, eventos y metadatos no sensibles.
- Las transacciones se hacen por acciones relevantes, no por tiempo.
- Si no ves transacciones reales, la causa probable es falta de configuracion de blockchain real o que la transaccion la este firmando el backend y no tu wallet.
