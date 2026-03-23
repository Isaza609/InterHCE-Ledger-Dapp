# Catálogos RIPS / SISPRO (Colombia)

---

## 1. modalidadTecnologiaSalud

| Código | Descripción |
|--------|------------|
| 01 | Intramural |
| 02 | Extramural |
| 03 | Telemedicina |
| 04 | Domiciliaria |

---

## 2. grupoServicios

| Código | Descripción |
|--------|------------|
| 01 | Consulta externa |
| 02 | Urgencias |
| 03 | Hospitalización |
| 04 | Apoyo diagnóstico y complementación terapéutica |
| 05 | Quirúrgicos |
| 06 | Protección específica y detección temprana |
| 07 | Rehabilitación |
| 08 | Atención domiciliaria |
| 09 | Telemedicina |
| 10 | Otros servicios |

---

## 3. viaIngresoUsuario

| Código | Descripción |
|--------|------------|
| 01 | Demanda espontánea |
| 02 | Remisión |
| 03 | Referencia |
| 04 | Urgencias |
| 05 | Programado |
| 06 | Traslado |

---

## 4. causaMotivoAtencion

| Código | Descripción |
|--------|------------|
| 01 | Promoción y prevención |
| 02 | Enfermedad general |
| 03 | Enfermedad laboral |
| 04 | Accidente de trabajo |
| 05 | Accidente de tránsito |
| 06 | Evento catastrófico |
| 07 | Lesión por agresión |
| 08 | Lesión autoinfligida |
| 09 | Otra causa |

---

## 5. condicionDestinoEgreso

| Código | Descripción |
|--------|------------|
| 01 | Domicilio |
| 02 | Remisión a otro prestador |
| 03 | Hospitalización |
| 04 | Fallecido |
| 05 | Alta voluntaria |
| 06 | Fuga |
| 07 | Traslado |
| 08 | Otro |

---

## 6. prestadoresReps

> Este NO es un catálogo cerrado estático.  
> Corresponde al **REPS (Registro Especial de Prestadores de Servicios de Salud)**.

### Estructura

| Campo | Descripción |
|------|------------|
| codigoHabilitacion | Código del prestador (único) |
| nombrePrestador | Nombre de la IPS |
| nit | Identificación |
| municipio | Código DANE |
| estado | Activo / Inactivo |

### Ejemplo

```json
{
  "codigoHabilitacion": "1900101234",
  "nombrePrestador": "Hospital Universitario San José",
  "nit": "900123456-7",
  "municipio": "19001",
  "estado": "ACTIVO"
}

| Código | Descripción          |
| ------ | -------------------- |
| M      | Masculino            |
| F      | Femenino             |
| I      | Intersexual          |
| T      | Transgénero          |
| NB     | No binario           |
| O      | Otro                 |
| NA     | No aplica            |
| NS     | No sabe / No informa |
