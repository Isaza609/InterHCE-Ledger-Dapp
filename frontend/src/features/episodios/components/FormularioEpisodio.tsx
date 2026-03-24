import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSesion } from "@/shared/auth/SessionContext";
import {
  getDisplayByCode,
  rdaCatalogos,
  type CatalogOption
} from "@/shared/catalogos/rdaCatalogos";
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

const etniaSinComunidadCodes = new Set(["NINGUNO", "6"]);

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

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function mergeWithDefaults<T>(base: T, incoming: unknown): T {
  if (incoming === undefined) {
    return cloneValue(base);
  }

  if (Array.isArray(base)) {
    const baseArray = base as unknown[];
    const incomingArray = Array.isArray(incoming) ? incoming : [];
    const maxLength = Math.max(baseArray.length, incomingArray.length);

    return Array.from({ length: maxLength }, (_, index) => {
      const baseValue = baseArray[index];
      const incomingValue = incomingArray[index];
      if (baseValue === undefined) {
        return cloneValue(incomingValue);
      }
      return mergeWithDefaults(baseValue, incomingValue);
    }) as T;
  }

  if (base && typeof base === "object") {
    const baseObject = base as Record<string, unknown>;
    const incomingObject = incoming && typeof incoming === "object"
      ? (incoming as Record<string, unknown>)
      : {};
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(incomingObject)]);

    for (const key of keys) {
      const baseValue = baseObject[key];
      const incomingValue = incomingObject[key];
      if (baseValue === undefined) {
        result[key] = cloneValue(incomingValue);
      } else {
        result[key] = mergeWithDefaults(baseValue, incomingValue);
      }
    }

    return result as T;
  }

  return (incoming as T) ?? base;
}

function splitDateTime(value?: string): { date: string; time: string } {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return { date: "", time: "" };
  }

  const [datePart = "", timePartRaw = ""] = normalized.split("T");
  const timePart = timePartRaw.replace(/Z$/, "").split(".")[0] ?? "";
  const [hours = "00", minutes = "00"] = timePart.split(":");

  return {
    date: datePart,
    time: `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`
  };
}

function buildFormValues(initialData?: EpisodioPayload | null, ipsId?: string): FormEpisodio {
  const merged = mergeWithDefaults(defaultValues, initialData ?? {}) as FormEpisodio;
  const start = splitDateTime(initialData?.encounter.period.start);
  const triage = splitDateTime(
    initialData?.encounter.extension?.find(
      (extension) => extension.url === ENCOUNTER_TRIAGE_TIME_URL
    )?.valueDateTime
  );
  const end = splitDateTime(initialData?.encounter.period.end);

  merged.startDate = start.date;
  merged.startTime = start.time || defaultValues.startTime;
  merged.triageDate = triage.date || start.date;
  merged.triageTime = triage.time || defaultValues.triageTime;
  merged.endDate = end.date;
  merged.endTime = end.time;

  if (!initialData?.prestadorOrigen?.identifier?.[0]?.value && ipsId) {
    merged.prestadorOrigen.identifier[0].value = ipsId;
  }

  return merged;
}

function renderCatalogOptions(options: CatalogOption[]) {
  return options.map((option) => (
    <option key={option.code} value={option.code}>
      {option.code} - {option.display}
    </option>
  ));
}

function renderCatalogSuggestions(options: CatalogOption[]) {
  return options.map((option) => (
    <option key={option.code} value={option.code} label={option.display} />
  ));
}

interface FormularioEpisodioProps {
  initialData?: EpisodioPayload | null;
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

  const dischargeDisposition = nextPayload.encounter.hospitalization?.dischargeDisposition;
  if (
    !hasValue(dischargeDisposition?.coding?.[0]?.code) &&
    !hasValue(dischargeDisposition?.coding?.[0]?.display)
  ) {
    delete nextPayload.encounter.hospitalization;
  }

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
  initialData,
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
    reset,
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
  const {
    tipoDocumentoPersona,
    epsAdres,
    paises,
    ocupacion,
    municipios,
    zonaTerritorial,
    modalidadTecnologiaSalud,
    grupoServicios,
    entornoAtencion,
    viaIngresoUsuario,
    causaMotivaAtencion,
    triageClasificacion,
    condicionDestinoEgreso,
    tipoDiagnostico,
    diagnosticosCie10,
    identidadGenero,
    etnia
  } = rdaCatalogos;

  const setCatalogDisplay = (
    path: string,
    options: CatalogOption[],
    selectedCode: string
  ) => {
    setValue(path as never, getDisplayByCode(options, selectedCode) as never, {
      shouldDirty: true
    });
  };

  const syncCatalogCodeAndDisplay = (
    codePath: string,
    displayPath: string,
    options: CatalogOption[],
    rawCode: string
  ) => {
    const normalizedCode = rawCode.trim().toUpperCase();
    const matchedOption = options.find((option) => option.code.toUpperCase() === normalizedCode);

    setValue(codePath as never, normalizedCode as never, {
      shouldDirty: true
    });
    setValue(displayPath as never, (matchedOption?.display ?? "") as never, {
      shouldDirty: true
    });
  };

  useEffect(() => {
    if (!initialData || !sesion?.ipsId) {
      return;
    }
    reset(buildFormValues(initialData, sesion.ipsId));
  }, [initialData, reset, sesion?.ipsId]);

  useEffect(() => {
    if (initialData || !sesion?.ipsId) {
      return;
    }
    setValue("prestadorOrigen.identifier.0.value", sesion.ipsId, {
      shouldDirty: false
    });
  }, [initialData, sesion?.ipsId, setValue]);

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
            <select
              id="eps-code"
              className="form-input"
              {...register("cobertura.payor.0.identifier.value", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay("cobertura.payor.0.display", epsAdres, event.target.value)
              })}
            >
              <option value="">Seleccione una EPS/EAPB</option>
              {renderCatalogOptions(epsAdres)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="eps-name" className="form-label form-label--required">
              Nombre administrador plan beneficios
            </label>
            <input
              id="eps-name"
              type="text"
              className="form-input"
              readOnly
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
            <select
              id="doc-type"
              className="form-input"
              {...register("patient.identifier.0.type.coding.0.code", { required: true })}
            >
              <option value="">Seleccione tipo de documento</option>
              {renderCatalogOptions(tipoDocumentoPersona)}
            </select>
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
            <select
              id="nationality-code"
              className="form-input"
              {...register("patient.extension.0.valueCodeableConcept.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "patient.extension.0.valueCodeableConcept.coding.0.display",
                    paises,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione pais</option>
              {renderCatalogOptions(paises)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="nationality-name" className="form-label form-label--required">
              Nombre pais nacionalidad
            </label>
            <input
              id="nationality-name"
              type="text"
              className="form-input"
              readOnly
              {...register("patient.extension.0.valueCodeableConcept.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="occupation-code" className="form-label form-label--required">
              Codigo ocupacion
            </label>
            <select
              id="occupation-code"
              className="form-input"
              {...register("patient.extension.5.valueCodeableConcept.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "patient.extension.5.valueCodeableConcept.coding.0.display",
                    ocupacion,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione ocupacion</option>
              {renderCatalogOptions(ocupacion)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="occupation-name" className="form-label form-label--required">
              Nombre ocupacion
            </label>
            <input
              id="occupation-name"
              type="text"
              className="form-input"
              readOnly
              {...register("patient.extension.5.valueCodeableConcept.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="res-country" className="form-label form-label--required">
              Codigo pais residencia
            </label>
            <select
              id="res-country"
              className="form-input"
              {...register("patient.address.0.country", { required: true })}
            >
              <option value="">Seleccione pais</option>
              {renderCatalogOptions(paises)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="municipio-code" className="form-label form-label--required">
              Codigo municipio residencia
            </label>
            <select
              id="municipio-code"
              className="form-input"
              {...register("patient.address.0.extension.0.valueCodeableConcept.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "patient.address.0.extension.0.valueCodeableConcept.coding.0.display",
                    municipios,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione municipio</option>
              {renderCatalogOptions(municipios)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="municipio-name" className="form-label form-label--required">
              Nombre municipio residencia
            </label>
            <input
              id="municipio-name"
              type="text"
              className="form-input"
              readOnly
              {...register("patient.address.0.extension.0.valueCodeableConcept.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="zona-code" className="form-label form-label--required">
              Zona territorial
            </label>
            <select
              id="zona-code"
              className="form-input"
              {...register("patient.address.0.extension.1.valueCodeableConcept.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "patient.address.0.extension.1.valueCodeableConcept.coding.0.display",
                    zonaTerritorial,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione zona</option>
              {renderCatalogOptions(zonaTerritorial)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="gender-identity" className="form-label">
              Identidad de genero
            </label>
            <select
              id="gender-identity"
              className="form-input"
              {...register("patient.extension.1.valueCodeableConcept.coding.0.code", {
                onChange: (event) =>
                  setCatalogDisplay(
                    "patient.extension.1.valueCodeableConcept.coding.0.display",
                    identidadGenero,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione identidad de genero</option>
              {renderCatalogOptions(identidadGenero)}
            </select>
            <input
              type="hidden"
              {...register("patient.extension.1.valueCodeableConcept.coding.0.display")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ethnicity-code" className="form-label">
              Etnia
            </label>
            <select
              id="ethnicity-code"
              className="form-input"
              {...register("patient.extension.2.valueCodeableConcept.coding.0.code", {
                onChange: (event) =>
                  setCatalogDisplay(
                    "patient.extension.2.valueCodeableConcept.coding.0.display",
                    etnia,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione etnia</option>
              {renderCatalogOptions(etnia)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="ethnicity-name" className="form-label">
              Nombre etnia
            </label>
            <input
              id="ethnicity-name"
              type="text"
              className="form-input"
              readOnly
              {...register("patient.extension.2.valueCodeableConcept.coding.0.display")}
            />
          </div>

          {etniaCode && !etniaSinComunidadCodes.has(etniaCode) && (
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
            <select
              id="modalidad-code"
              className="form-input"
              {...register("encounter.type.0.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "encounter.type.0.coding.0.display",
                    modalidadTecnologiaSalud,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione modalidad</option>
              {renderCatalogOptions(modalidadTecnologiaSalud)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="grupo-servicio" className="form-label form-label--required">
              Grupo servicios
            </label>
            <select
              id="grupo-servicio"
              className="form-input"
              {...register("encounter.serviceType.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "encounter.serviceType.coding.0.display",
                    grupoServicios,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione grupo</option>
              {renderCatalogOptions(grupoServicios)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="entorno-code" className="form-label form-label--required">
              Entorno atencion
            </label>
            <select
              id="entorno-code"
              className="form-input"
              {...register("encounter.class.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "encounter.class.coding.0.display",
                    entornoAtencion,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione entorno</option>
              {renderCatalogOptions(entornoAtencion)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="via-ingreso" className="form-label form-label--required">
              Via ingreso
            </label>
            <select
              id="via-ingreso"
              className="form-input"
              {...register("encounter.extension.0.valueCodeableConcept.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "encounter.extension.0.valueCodeableConcept.coding.0.display",
                    viaIngresoUsuario,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione via de ingreso</option>
              {renderCatalogOptions(viaIngresoUsuario)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="causa-code" className="form-label form-label--required">
              Causa que motiva atencion
            </label>
            <select
              id="causa-code"
              className="form-input"
              {...register("encounter.reasonCode.0.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "encounter.reasonCode.0.coding.0.display",
                    causaMotivaAtencion,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione causa</option>
              {renderCatalogOptions(causaMotivaAtencion)}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="triage-level" className="form-label form-label--required">
              Clasificacion triage
            </label>
            <select
              id="triage-level"
              className="form-input"
              {...register("encounter.priority.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "encounter.priority.coding.0.display",
                    triageClasificacion,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione triage</option>
              {renderCatalogOptions(triageClasificacion)}
            </select>
          </div>

          {status === "finished" && (
            <>
              <div className="form-group">
                <label htmlFor="egreso-code" className="form-label form-label--required">
                  Condicion y destino egreso
                </label>
                <select
                  id="egreso-code"
                  className="form-input"
                  {...register("encounter.hospitalization.dischargeDisposition.coding.0.code", {
                    required: true,
                    onChange: (event) =>
                      setCatalogDisplay(
                        "encounter.hospitalization.dischargeDisposition.coding.0.display",
                        condicionDestinoEgreso,
                        event.target.value
                      )
                  })}
                >
                  <option value="">Seleccione condicion/destino</option>
                  {renderCatalogOptions(condicionDestinoEgreso)}
                </select>
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
              list="diagnosticos-cie10"
              className="form-input"
              {...register("diagnosticoIngreso.code.coding.0.code", {
                required: true,
                onChange: (event) =>
                  syncCatalogCodeAndDisplay(
                    "diagnosticoIngreso.code.coding.0.code",
                    "diagnosticoIngreso.code.coding.0.display",
                    diagnosticosCie10,
                    event.target.value
                  )
              })}
            />
            <datalist id="diagnosticos-cie10">
              {renderCatalogSuggestions(diagnosticosCie10)}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="dx-ingreso-name" className="form-label form-label--required">
              Nombre diagnostico ingreso
            </label>
            <input
              id="dx-ingreso-name"
              type="text"
              className="form-input"
              readOnly
              {...register("diagnosticoIngreso.code.coding.0.display", { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="dx-ingreso-type" className="form-label form-label--required">
              Tipo diagnostico ingreso
            </label>
            <select
              id="dx-ingreso-type"
              className="form-input"
              {...register("diagnosticoIngreso.category.0.coding.0.code", {
                required: true,
                onChange: (event) =>
                  setCatalogDisplay(
                    "diagnosticoIngreso.category.0.coding.0.display",
                    tipoDiagnostico,
                    event.target.value
                  )
              })}
            >
              <option value="">Seleccione tipo</option>
              {renderCatalogOptions(tipoDiagnostico)}
            </select>
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
                  list="diagnosticos-cie10"
                  className="form-input"
                  {...register("diagnosticoEgreso.code.coding.0.code", {
                    required: true,
                    onChange: (event) =>
                      syncCatalogCodeAndDisplay(
                        "diagnosticoEgreso.code.coding.0.code",
                        "diagnosticoEgreso.code.coding.0.display",
                        diagnosticosCie10,
                        event.target.value
                      )
                  })}
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
                  readOnly
                  {...register("diagnosticoEgreso.code.coding.0.display", { required: true })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dx-egreso-type" className="form-label form-label--required">
                  Tipo diagnostico egreso
                </label>
                <select
                  id="dx-egreso-type"
                  className="form-input"
                  {...register("diagnosticoEgreso.category.0.coding.0.code", {
                    required: true,
                    onChange: (event) =>
                      setCatalogDisplay(
                        "diagnosticoEgreso.category.0.coding.0.display",
                        tipoDiagnostico,
                        event.target.value
                      )
                  })}
                >
                  <option value="">Seleccione tipo</option>
                  {renderCatalogOptions(tipoDiagnostico)}
                </select>
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
            <select
              id="alta-doc-type"
              className="form-input"
              {...register("profesionalAlta.identifier.0.type.coding.0.code", {
                required: altaCamposObligatorios
              })}
            >
              <option value="">Seleccione tipo de documento</option>
              {renderCatalogOptions(tipoDocumentoPersona)}
            </select>
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
