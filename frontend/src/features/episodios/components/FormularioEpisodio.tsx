import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSesion } from "@/shared/auth/SessionContext";
import type { EpisodioPayload } from "@/shared/types/episodio";
import { toDateTimeLocal } from "@/shared/utils/episodioPayload";
import { ErroresValidacion } from "./ErroresValidacion";

const PATIENT_NATIONALITY_URL = "urn:interhce:rda:patient-nationality";
const PATIENT_GENDER_IDENTITY_URL = "urn:interhce:rda:patient-gender-identity";
const PATIENT_ETHNICITY_URL = "urn:interhce:rda:patient-ethnicity";
const PATIENT_ETHNIC_COMMUNITY_URL = "urn:interhce:rda:patient-ethnic-community";
const PATIENT_DISABILITY_URL = "urn:interhce:rda:patient-disability";
const PATIENT_OCCUPATION_URL = "urn:interhce:rda:patient-occupation";
const ADDRESS_MUNICIPALITY_URL = "urn:interhce:rda:address-municipality";
const ADDRESS_ZONE_URL = "urn:interhce:rda:address-zone";
const ENCOUNTER_ROUTE_URL = "urn:interhce:rda:encounter-route";
const ENCOUNTER_TRIAGE_TIME_URL = "urn:interhce:rda:encounter-triage-time";

type FormEpisodio = EpisodioPayload & {
  startDate?: string;
  startTime?: string;
  triageDate?: string;
  triageTime?: string;
  endDate?: string;
  endTime?: string;
};

const defaultValues: FormEpisodio = {
  patient: {
    resourceType: "Patient",
    identifier: [
      {
        value: "",
        type: { coding: [{ code: "CC", display: "Cedula de ciudadania" }] }
      }
    ],
    name: [{ family: "", given: [""] }],
    birthDate: "",
    gender: "female",
    extension: [
      {
        url: PATIENT_NATIONALITY_URL,
        valueCodeableConcept: { coding: [{ code: "CO", display: "Colombia" }] }
      },
      {
        url: PATIENT_GENDER_IDENTITY_URL,
        valueCodeableConcept: { coding: [{ code: "", display: "" }] }
      },
      {
        url: PATIENT_ETHNICITY_URL,
        valueCodeableConcept: { coding: [{ code: "NINGUNO", display: "Ninguno" }] }
      },
      {
        url: PATIENT_ETHNIC_COMMUNITY_URL,
        valueString: ""
      },
      {
        url: PATIENT_DISABILITY_URL,
        valueCodeableConcept: { coding: [{ code: "", display: "" }] }
      },
      {
        url: PATIENT_OCCUPATION_URL,
        valueCodeableConcept: { coding: [{ code: "", display: "" }] }
      }
    ],
    address: [
      {
        country: "CO",
        extension: [
          {
            url: ADDRESS_MUNICIPALITY_URL,
            valueCodeableConcept: { coding: [{ code: "", display: "" }] }
          },
          {
            url: ADDRESS_ZONE_URL,
            valueCodeableConcept: { coding: [{ code: "U", display: "Urbano" }] }
          }
        ]
      }
    ]
  },
  cobertura: {
    resourceType: "Coverage",
    beneficiary: { reference: "Patient/1" },
    payor: [
      {
        identifier: { value: "" },
        display: ""
      }
    ]
  },
  encounter: {
    resourceType: "Encounter",
    status: "in-progress",
    class: { coding: [{ code: "INTRAMURAL", display: "Intramural" }] },
    type: [{ coding: [{ code: "", display: "" }] }],
    serviceType: { coding: [{ code: "", display: "" }] },
    subject: { reference: "Patient/1" },
    serviceProvider: { reference: "Organization/1" },
    period: { start: "", end: "" },
    reasonCode: [{ coding: [{ code: "", display: "" }] }],
    priority: { coding: [{ code: "III", display: "Triage III" }] },
    hospitalization: {
      dischargeDisposition: { coding: [{ code: "", display: "" }] }
    },
    extension: [
      {
        url: ENCOUNTER_ROUTE_URL,
        valueCodeableConcept: { coding: [{ code: "", display: "" }] }
      },
      {
        url: ENCOUNTER_TRIAGE_TIME_URL,
        valueDateTime: ""
      }
    ]
  },
  prestadorOrigen: {
    resourceType: "Organization",
    identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: "" }]
  },
  prestadorDestino: {
    resourceType: "Organization",
    identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: "" }]
  },
  diagnosticoIngreso: {
    resourceType: "Condition",
    code: {
      coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "", display: "" }]
    },
    category: [{ coding: [{ code: "principal", display: "Principal" }] }],
    subject: { reference: "Patient/1" }
  },
  diagnosticoEgreso: {
    resourceType: "Condition",
    code: {
      coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "", display: "" }]
    },
    category: [{ coding: [{ code: "principal", display: "Principal" }] }],
    subject: { reference: "Patient/1" }
  },
  profesionalAlta: {
    resourceType: "Practitioner",
    identifier: [
      {
        value: "",
        type: { coding: [{ code: "CC", display: "Cedula de ciudadania" }] }
      }
    ]
  },
  documentoSoporte: {
    resourceType: "DocumentReference",
    subject: { reference: "Patient/1" },
    content: [
      {
        attachment: {
          title: "",
          contentType: "application/pdf"
        }
      }
    ]
  },
  startDate: "",
  startTime: "08:00",
  triageDate: "",
  triageTime: "08:15",
  endDate: "",
  endTime: ""
};

interface FormularioEpisodioProps {
  onValidar?: (payload: EpisodioPayload) => void;
  onRegistrar?: (payload: EpisodioPayload) => void;
  actionLabel?: string;
  result?: {
    valid: boolean;
    message?: string;
    details?: { field: string; issue: string }[];
    episodeId?: string;
    documentHash?: string;
    traceEvent?: {
      evidence?: {
        transactionHash?: string;
      };
    };
  } | null;
  loading?: boolean;
}

function buildPayload(data: FormEpisodio): EpisodioPayload {
  const {
    startDate: _startDate,
    startTime: _startTime,
    triageDate: _triageDate,
    triageTime: _triageTime,
    endDate: _endDate,
    endTime: _endTime,
    ...payload
  } = data;
  const start = toDateTimeLocal(data.startDate ?? "", data.startTime ?? "");
  const triage = toDateTimeLocal(data.triageDate ?? "", data.triageTime ?? "");
  const end = data.endDate?.trim()
    ? toDateTimeLocal(data.endDate, data.endTime ?? "00:00")
    : undefined;

  const extensions = [...(payload.encounter.extension ?? [])];
  if (extensions[1]) {
    extensions[1] = {
      ...extensions[1],
      valueDateTime: triage
    };
  }

  const nextPayload: EpisodioPayload = {
    ...payload,
    encounter: {
      ...payload.encounter,
      period: { start, ...(end ? { end } : {}) },
      extension: extensions
    }
  };

  const hasValue = (value?: string) => Boolean(value?.trim());
  const isFinished = nextPayload.encounter.status === "finished";

  const genderIdentity = nextPayload.patient.extension?.find(
    (extension) => extension.url === PATIENT_GENDER_IDENTITY_URL
  );
  if (
    !hasValue(genderIdentity?.valueCodeableConcept?.coding?.[0]?.code) &&
    !hasValue(genderIdentity?.valueCodeableConcept?.coding?.[0]?.display)
  ) {
    nextPayload.patient.extension = nextPayload.patient.extension?.filter(
      (extension) => extension.url !== PATIENT_GENDER_IDENTITY_URL
    );
  }

  const ethnicity = nextPayload.patient.extension?.find(
    (extension) => extension.url === PATIENT_ETHNICITY_URL
  );
  if (
    !hasValue(ethnicity?.valueCodeableConcept?.coding?.[0]?.code) &&
    !hasValue(ethnicity?.valueCodeableConcept?.coding?.[0]?.display)
  ) {
    nextPayload.patient.extension = nextPayload.patient.extension?.filter(
      (extension) => extension.url !== PATIENT_ETHNICITY_URL
    );
  }

  const ethnicCommunity = nextPayload.patient.extension?.find(
    (extension) => extension.url === PATIENT_ETHNIC_COMMUNITY_URL
  );
  if (!hasValue(ethnicCommunity?.valueString)) {
    nextPayload.patient.extension = nextPayload.patient.extension?.filter(
      (extension) => extension.url !== PATIENT_ETHNIC_COMMUNITY_URL
    );
  }

  const disability = nextPayload.patient.extension?.find(
    (extension) => extension.url === PATIENT_DISABILITY_URL
  );
  if (
    !hasValue(disability?.valueCodeableConcept?.coding?.[0]?.code) &&
    !hasValue(disability?.valueCodeableConcept?.coding?.[0]?.display)
  ) {
    nextPayload.patient.extension = nextPayload.patient.extension?.filter(
      (extension) => extension.url !== PATIENT_DISABILITY_URL
    );
  }

  if (!isFinished || !hasValue(nextPayload.prestadorDestino?.identifier?.[0]?.value)) {
    delete nextPayload.prestadorDestino;
  }

  if (
    !isFinished ||
    !hasValue(nextPayload.diagnosticoEgreso?.code?.coding?.[0]?.code) ||
    !hasValue(nextPayload.diagnosticoEgreso?.code?.coding?.[0]?.display)
  ) {
    delete nextPayload.diagnosticoEgreso;
  }

  if (!isFinished || !hasValue(nextPayload.profesionalAlta?.identifier?.[0]?.value)) {
    delete nextPayload.profesionalAlta;
  }

  if (
    !isFinished ||
    !hasValue(nextPayload.documentoSoporte?.content?.[0]?.attachment?.title)
  ) {
    delete nextPayload.documentoSoporte;
  }

  return nextPayload;
}

export function FormularioEpisodio({
  onValidar,
  onRegistrar,
  actionLabel = "Registrar episodio",
  result,
  loading = false
}: FormularioEpisodioProps) {
  const { sesion } = useSesion();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm<FormEpisodio>({
    defaultValues
  });

  const currentIps = useWatch({
    control,
    name: "prestadorOrigen.identifier.0.value"
  });
  const status = useWatch({
    control,
    name: "encounter.status"
  });
  const etniaCode = useWatch({
    control,
    name: "patient.extension.2.valueCodeableConcept.coding.0.code"
  });
  const altaCamposObligatorios = status === "finished";

  useEffect(() => {
    if (sesion?.ipsId) {
      setValue("prestadorOrigen.identifier.0.value", sesion.ipsId, {
        shouldDirty: false
      });
    }
  }, [sesion?.ipsId, setValue]);

  const submit = (data: FormEpisodio, action: "validar" | "registrar") => {
    const payload = buildPayload(data);
    if (action === "validar") onValidar?.(payload);
    else onRegistrar?.(payload);
  };

  const onValidarClick = () => void handleSubmit((data) => submit(data, "validar"))();
  const onRegistrarClick = () => void handleSubmit((data) => submit(data, "registrar"))();

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="form-section form-section--stacked"
      noValidate
      aria-label="Formulario de episodio clinico de urgencias"
    >
      <div className="form-summary">
        <div>
          <strong>Quien registra</strong>
          <span>{sesion?.nombre ?? "Usuario autenticado requerido"}</span>
        </div>
        <div>
          <strong>IPS</strong>
          <span>{currentIps || sesion?.ipsId || "Debe indicar la IPS origen"}</span>
        </div>
        <div>
          <strong>Cobertura</strong>
          <span>Formulario alineado con RDA completo y mapeo FHIR</span>
        </div>
      </div>

      <fieldset className="form-card">
        <legend>1. Identificacion y cobertura</legend>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="prestador-reps" className="form-label form-label--required">
              Codigo prestador origen
            </label>
            <input
              id="prestador-reps"
              type="text"
              className="form-input"
              defaultValue={sesion?.ipsId ?? ""}
              {...register("prestadorOrigen.identifier.0.value", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="eps-code" className="form-label form-label--required">
              Codigo administrador plan beneficios
            </label>
            <input
              id="eps-code"
              type="text"
              className="form-input"
              {...register("cobertura.payor.0.identifier.value", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="eps-name" className="form-label form-label--required">
              Nombre administrador plan beneficios
            </label>
            <input
              id="eps-name"
              type="text"
              className="form-input"
              {...register("cobertura.payor.0.display", { required: true })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-card">
        <legend>2. Paciente y datos sociodemograficos</legend>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="doc-type" className="form-label form-label--required">
              Tipo documento
            </label>
            <input
              id="doc-type"
              type="text"
              className="form-input"
              {...register("patient.identifier.0.type.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="patient-identifier" className="form-label form-label--required">
              Numero documento
            </label>
            <input
              id="patient-identifier"
              type="text"
              className="form-input"
              {...register("patient.identifier.0.value", { required: true })}
              aria-invalid={Boolean(errors.patient?.identifier?.[0]?.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="patient-family" className="form-label form-label--required">
              Primer apellido
            </label>
            <input
              id="patient-family"
              type="text"
              className="form-input"
              {...register("patient.name.0.family", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="patient-given" className="form-label form-label--required">
              Primer nombre
            </label>
            <input
              id="patient-given"
              type="text"
              className="form-input"
              {...register("patient.name.0.given.0", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="patient-birthDate" className="form-label form-label--required">
              Fecha nacimiento
            </label>
            <input
              id="patient-birthDate"
              type="date"
              className="form-input form-input--date"
              {...register("patient.birthDate", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="patient-gender" className="form-label form-label--required">
              Sexo biologico
            </label>
            <select
              id="patient-gender"
              className="form-input"
              {...register("patient.gender", { required: true })}
            >
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
              <option value="unknown">Desconocido</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="nationality-code" className="form-label form-label--required">
              Codigo pais nacionalidad
            </label>
            <input
              id="nationality-code"
              type="text"
              className="form-input"
              {...register("patient.extension.0.valueCodeableConcept.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="nationality-name" className="form-label form-label--required">
              Nombre pais nacionalidad
            </label>
            <input
              id="nationality-name"
              type="text"
              className="form-input"
              {...register("patient.extension.0.valueCodeableConcept.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="occupation-code" className="form-label form-label--required">
              Codigo ocupacion
            </label>
            <input
              id="occupation-code"
              type="text"
              className="form-input"
              {...register("patient.extension.5.valueCodeableConcept.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="occupation-name" className="form-label form-label--required">
              Nombre ocupacion
            </label>
            <input
              id="occupation-name"
              type="text"
              className="form-input"
              {...register("patient.extension.5.valueCodeableConcept.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="res-country" className="form-label form-label--required">
              Codigo pais residencia
            </label>
            <input
              id="res-country"
              type="text"
              className="form-input"
              {...register("patient.address.0.country", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="municipio-code" className="form-label form-label--required">
              Codigo municipio residencia
            </label>
            <input
              id="municipio-code"
              type="text"
              className="form-input"
              {...register("patient.address.0.extension.0.valueCodeableConcept.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="municipio-name" className="form-label form-label--required">
              Nombre municipio residencia
            </label>
            <input
              id="municipio-name"
              type="text"
              className="form-input"
              {...register("patient.address.0.extension.0.valueCodeableConcept.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="zona-code" className="form-label form-label--required">
              Zona territorial
            </label>
            <input
              id="zona-code"
              type="text"
              className="form-input"
              {...register("patient.address.0.extension.1.valueCodeableConcept.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="gender-identity" className="form-label">
              Identidad de genero
            </label>
            <input
              id="gender-identity"
              type="text"
              className="form-input"
              {...register("patient.extension.1.valueCodeableConcept.coding.0.display")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ethnicity-code" className="form-label">
              Etnia
            </label>
            <input
              id="ethnicity-code"
              type="text"
              className="form-input"
              {...register("patient.extension.2.valueCodeableConcept.coding.0.code")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ethnicity-name" className="form-label">
              Nombre etnia
            </label>
            <input
              id="ethnicity-name"
              type="text"
              className="form-input"
              {...register("patient.extension.2.valueCodeableConcept.coding.0.display")}
            />
          </div>

          {etniaCode && etniaCode !== "NINGUNO" && (
            <div className="form-group">
              <label htmlFor="ethnic-community" className="form-label form-label--required">
                Comunidad etnica
              </label>
              <input
                id="ethnic-community"
                type="text"
                className="form-input"
                {...register("patient.extension.3.valueString", { required: true })}
              />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="form-card">
        <legend>3. Atencion de urgencias</legend>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="encounter-status" className="form-label form-label--required">
              Estado del episodio
            </label>
            <select
              id="encounter-status"
              className="form-input"
              {...register("encounter.status", { required: true })}
            >
              <option value="finished">Finalizado</option>
              <option value="in-progress">En curso</option>
              <option value="planned">Planeado</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="startDate" className="form-label form-label--required">
              Inicio atencion
            </label>
            <div className="form-input--inline-group">
              <input
                id="startDate"
                type="date"
                className="form-input form-input--date"
                {...register("startDate", { required: true })}
              />
              <input
                id="startTime"
                type="time"
                step="1"
                className="form-input form-input--time"
                {...register("startTime", { required: true })}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="triageDate" className="form-label form-label--required">
              Fecha y hora triage
            </label>
            <div className="form-input--inline-group">
              <input
                id="triageDate"
                type="date"
                className="form-input form-input--date"
                {...register("triageDate", { required: true })}
              />
              <input
                id="triageTime"
                type="time"
                step="1"
                className="form-input form-input--time"
                {...register("triageTime", { required: true })}
              />
            </div>
          </div>

          {status === "finished" && (
            <div className="form-group">
              <label htmlFor="endDate" className="form-label form-label--required">
                Fin atencion
              </label>
              <div className="form-input--inline-group">
                <input
                  id="endDate"
                  type="date"
                  className="form-input form-input--date"
                  {...register("endDate", { required: true })}
                />
                <input
                  id="endTime"
                  type="time"
                  step="1"
                  className="form-input form-input--time"
                  {...register("endTime", { required: true })}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="modalidad-code" className="form-label form-label--required">
              Modalidad tecnologia salud
            </label>
            <input
              id="modalidad-code"
              type="text"
              className="form-input"
              {...register("encounter.type.0.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="grupo-servicio" className="form-label form-label--required">
              Grupo servicios
            </label>
            <input
              id="grupo-servicio"
              type="text"
              className="form-input"
              {...register("encounter.serviceType.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="entorno-code" className="form-label form-label--required">
              Entorno atencion
            </label>
            <input
              id="entorno-code"
              type="text"
              className="form-input"
              {...register("encounter.class.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="via-ingreso" className="form-label form-label--required">
              Via ingreso
            </label>
            <input
              id="via-ingreso"
              type="text"
              className="form-input"
              {...register("encounter.extension.0.valueCodeableConcept.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="causa-code" className="form-label form-label--required">
              Causa que motiva atencion
            </label>
            <input
              id="causa-code"
              type="text"
              className="form-input"
              {...register("encounter.reasonCode.0.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="triage-level" className="form-label form-label--required">
              Clasificacion triage
            </label>
            <input
              id="triage-level"
              type="text"
              className="form-input"
              {...register("encounter.priority.coding.0.code", { required: true })}
            />
          </div>

          {status === "finished" && (
            <>
              <div className="form-group">
                <label htmlFor="egreso-code" className="form-label form-label--required">
                  Condicion y destino egreso
                </label>
                <input
                  id="egreso-code"
                  type="text"
                  className="form-input"
                  {...register("encounter.hospitalization.dischargeDisposition.coding.0.code", {
                    required: true
                  })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prestador-destino" className="form-label form-label--required">
                  Prestador destino
                </label>
                <input
                  id="prestador-destino"
                  type="text"
                  className="form-input"
                  {...register("prestadorDestino.identifier.0.value", { required: true })}
                />
              </div>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="form-card">
        <legend>4. Diagnosticos</legend>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="dx-ingreso-code" className="form-label form-label--required">
              Diagnostico ingreso CIE-10
            </label>
            <input
              id="dx-ingreso-code"
              type="text"
              className="form-input"
              {...register("diagnosticoIngreso.code.coding.0.code", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="dx-ingreso-name" className="form-label form-label--required">
              Nombre diagnostico ingreso
            </label>
            <input
              id="dx-ingreso-name"
              type="text"
              className="form-input"
              {...register("diagnosticoIngreso.code.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="dx-ingreso-type" className="form-label form-label--required">
              Tipo diagnostico ingreso
            </label>
            <input
              id="dx-ingreso-type"
              type="text"
              className="form-input"
              {...register("diagnosticoIngreso.category.0.coding.0.code", { required: true })}
            />
          </div>

          {status === "finished" && (
            <>
              <div className="form-group">
                <label htmlFor="dx-egreso-code" className="form-label form-label--required">
                  Diagnostico egreso CIE-10
                </label>
                <input
                  id="dx-egreso-code"
                  type="text"
                  className="form-input"
                  {...register("diagnosticoEgreso.code.coding.0.code", { required: true })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dx-egreso-name" className="form-label form-label--required">
                  Nombre diagnostico egreso
                </label>
                <input
                  id="dx-egreso-name"
                  type="text"
                  className="form-input"
                  {...register("diagnosticoEgreso.code.coding.0.display", { required: true })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dx-egreso-type" className="form-label form-label--required">
                  Tipo diagnostico egreso
                </label>
                <input
                  id="dx-egreso-type"
                  type="text"
                  className="form-input"
                  {...register("diagnosticoEgreso.category.0.coding.0.code", { required: true })}
                />
              </div>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="form-card">
        <legend>5. Alta y soporte</legend>
        <div className="form-columns">
          <div className="form-group">
            <label
              htmlFor="alta-doc-type"
              className={`form-label${altaCamposObligatorios ? " form-label--required" : ""}`}
            >
              Tipo documento profesional alta
            </label>
            <input
              id="alta-doc-type"
              type="text"
              className="form-input"
              {...register("profesionalAlta.identifier.0.type.coding.0.code", {
                required: altaCamposObligatorios
              })}
            />
          </div>

          <div className="form-group">
            <label
              htmlFor="alta-doc-number"
              className={`form-label${altaCamposObligatorios ? " form-label--required" : ""}`}
            >
              Numero documento profesional alta
            </label>
            <input
              id="alta-doc-number"
              type="text"
              className="form-input"
              {...register("profesionalAlta.identifier.0.value", {
                required: altaCamposObligatorios
              })}
            />
          </div>

          <div className="form-group">
            <label
              htmlFor="doc-title"
              className={`form-label${altaCamposObligatorios ? " form-label--required" : ""}`}
            >
              Nombre documento soporte PDF
            </label>
            <input
              id="doc-title"
              type="text"
              className="form-input"
              {...register("documentoSoporte.content.0.attachment.title", {
                required: altaCamposObligatorios
              })}
            />
          </div>
        </div>
      </fieldset>

      <div className="form-toolbar">
        <div>
          <strong>Antes de enviar</strong>
          <p>
            Este formulario cubre los campos obligatorios del RDA completo para el episodio y
            su cierre. Los bloques repetibles de procedimientos, medicamentos y tecnologias se
            mantienen disponibles por API para la siguiente iteracion.
          </p>
        </div>
        <div className="btn-group">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onValidarClick}
            disabled={loading}
          >
            {loading ? "Enviando..." : "Validar antes de guardar"}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRegistrarClick}
            disabled={loading}
          >
            {loading ? "Enviando..." : actionLabel}
          </button>
        </div>
      </div>

      {result != null && (
        <section
          role="status"
          aria-live="polite"
          className={result.valid ? "alert alert--success" : "alert alert--error"}
          style={{ marginTop: "1.5rem" }}
        >
          <p style={{ margin: 0 }}>{result.message}</p>
          {result.valid && result.episodeId && (
            <div className="result-panel">
              <div>
                <strong>ID del episodio</strong>
                <code>{result.episodeId}</code>
              </div>
              {result.documentHash && (
                <div>
                  <strong>Hash del documento</strong>
                  <code>{result.documentHash}</code>
                </div>
              )}
              {result.traceEvent?.evidence?.transactionHash && (
                <div>
                  <strong>Evidencia blockchain</strong>
                  <code>{result.traceEvent.evidence.transactionHash}</code>
                </div>
              )}
            </div>
          )}
          {!result.valid && result.details && result.details.length > 0 && (
            <ErroresValidacion issues={result.details} />
          )}
        </section>
      )}
    </form>
  );
}
