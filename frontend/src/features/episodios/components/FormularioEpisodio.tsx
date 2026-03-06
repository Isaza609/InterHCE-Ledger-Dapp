import { useForm } from "react-hook-form";
import type { EpisodioPayload } from "@/shared/types/episodio";
import { toDateTimeLocal } from "@/shared/utils/episodioPayload";
import { ErroresValidacion } from "./ErroresValidacion";

/** Valores del formulario: payload + campos auxiliares fecha/hora para el periodo. */
type FormEpisodio = EpisodioPayload & {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
};

const defaultValues: FormEpisodio = {
  patient: {
    resourceType: "Patient",
    identifier: [{ value: "" }],
    name: [{ family: "", given: [""] }],
    birthDate: "",
    gender: "unknown"
  },
  encounter: {
    resourceType: "Encounter",
    status: "in-progress",
    class: { coding: [{ code: "EMER", display: "Urgencias" }] },
    subject: { reference: "Patient/1" },
    serviceProvider: { reference: "Organization/1" },
    period: { start: "", end: "" }
  },
  prestadorOrigen: {
    resourceType: "Organization",
    identifier: [{ system: "https://prestadores.minsalud.gov.co/", value: "" }]
  },
  diagnosticoIngreso: {
    resourceType: "Condition",
    code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "" }] },
    subject: { reference: "Patient/1" }
  },
  startDate: "",
  startTime: "00:00",
  endDate: "",
  endTime: ""
};

interface FormularioEpisodioProps {
  onValidar?: (payload: EpisodioPayload) => void;
  onRegistrar?: (payload: EpisodioPayload) => void;
  result?: {
    valid: boolean;
    message?: string;
    details?: { field: string; issue: string }[];
    episodeId?: string;
    documentHash?: string;
  } | null;
  loading?: boolean;
}

function buildPayload(data: FormEpisodio): EpisodioPayload {
  const start = toDateTimeLocal(data.startDate ?? "", data.startTime ?? "");
  const end = data.endDate?.trim()
    ? toDateTimeLocal(data.endDate, data.endTime ?? "00:00")
    : undefined;
  return {
    ...data,
    encounter: {
      ...data.encounter,
      period: { start, ...(end ? { end } : {}) }
    }
  };
}

export function FormularioEpisodio({
  onValidar,
  onRegistrar,
  result,
  loading = false
}: FormularioEpisodioProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormEpisodio>({
    defaultValues
  });

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
      className="form-section"
      noValidate
      aria-label="Formulario de episodio clínico (HCE urgencias)"
    >
      <fieldset className="form-section" aria-describedby="paciente-desc">
        <legend>Paciente</legend>
        <span id="paciente-desc" className="visually-hidden">
          Datos de identificación del paciente
        </span>
        <div className="form-group">
          <label htmlFor="patient-identifier" className="form-label form-label--required">
            Identificador (ej. documento)
          </label>
          <input
            id="patient-identifier"
            type="text"
            className="form-input"
            {...register("patient.identifier.0.value", { required: true })}
            aria-required="true"
            aria-invalid={Boolean(errors.patient?.identifier?.[0]?.value)}
            aria-describedby={errors.patient?.identifier?.[0]?.value ? "err-identifier" : undefined}
          />
          {errors.patient?.identifier?.[0]?.value && (
            <span id="err-identifier" className="form-error" role="alert">
              Requerido
            </span>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="patient-family" className="form-label form-label--required">
            Apellido (family)
          </label>
          <input
            id="patient-family"
            type="text"
            className="form-input"
            {...register("patient.name.0.family", { required: true })}
            aria-required="true"
          />
        </div>
        <div className="form-group">
          <label htmlFor="patient-given" className="form-label form-label--required">
            Nombre (given)
          </label>
          <input
            id="patient-given"
            type="text"
            className="form-input"
            {...register("patient.name.0.given.0", { required: true })}
            aria-required="true"
          />
        </div>
        <div className="form-group">
          <label htmlFor="patient-birthDate" className="form-label form-label--required">
            Fecha de nacimiento
          </label>
          <input
            id="patient-birthDate"
            type="date"
            className="form-input form-input--date"
            {...register("patient.birthDate", { required: true })}
            aria-required="true"
            aria-invalid={Boolean(errors.patient?.birthDate)}
            aria-describedby={errors.patient?.birthDate ? "err-birthDate" : undefined}
          />
          {errors.patient?.birthDate && (
            <span id="err-birthDate" className="form-error" role="alert">
              Requerido
            </span>
          )}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Encuentro (urgencias)</legend>
        <div className="form-group">
          <label htmlFor="startDate" className="form-label form-label--required">
            Inicio de atención
          </label>
          <div className="form-input--inline-group">
            <input
              id="startDate"
              type="date"
              className="form-input form-input--date"
              {...register("startDate", { required: true })}
              aria-required="true"
              aria-invalid={Boolean(errors.startDate)}
              aria-describedby={errors.startDate ? "err-startDate" : undefined}
            />
            <input
              id="startTime"
              type="time"
              step="1"
              className="form-input form-input--time"
              {...register("startTime")}
              aria-label="Hora de inicio"
            />
          </div>
          {errors.startDate && (
            <span id="err-startDate" className="form-error" role="alert">
              Fecha de inicio requerida
            </span>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="endDate" className="form-label">
            Fin de atención (opcional)
          </label>
          <div className="form-input--inline-group">
            <input
              id="endDate"
              type="date"
              className="form-input form-input--date"
              {...register("endDate")}
            />
            <input
              id="endTime"
              type="time"
              step="1"
              className="form-input form-input--time"
              {...register("endTime")}
              aria-label="Hora de fin"
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="encounter-class" className="form-label form-label--required">
            Clase (código, ej. EMER)
          </label>
          <input
            id="encounter-class"
            type="text"
            className="form-input"
            {...register("encounter.class.coding.0.code", { required: true })}
            aria-required="true"
          />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Prestador origen (IPS)</legend>
        <div className="form-group">
          <label htmlFor="prestador-reps" className="form-label form-label--required">
            Código REPS
          </label>
          <input
            id="prestador-reps"
            type="text"
            className="form-input"
            {...register("prestadorOrigen.identifier.0.value", { required: true })}
            aria-required="true"
          />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Diagnóstico principal de ingreso (CIE-10)</legend>
        <div className="form-group">
          <label htmlFor="diagnostico-cie10" className="form-label form-label--required">
            Código CIE-10
          </label>
          <input
            id="diagnostico-cie10"
            type="text"
            className="form-input"
            {...register("diagnosticoIngreso.code.coding.0.code", { required: true })}
            aria-required="true"
          />
        </div>
      </fieldset>

      <div className="btn-group" style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onValidarClick}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Enviando…" : "Validar episodio"}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onRegistrarClick}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Enviando…" : "Registrar episodio"}
        </button>
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
            <div style={{ marginTop: "0.75rem" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>ID del episodio (guárdelo para consultas):</p>
              <code
                style={{
                  display: "block",
                  marginTop: "0.25rem",
                  padding: "0.5rem",
                  background: "var(--surface-2, #f0f0f0)",
                  borderRadius: "4px",
                  wordBreak: "break-all",
                  fontSize: "0.9rem"
                }}
                title="Copiar"
              >
                {result.episodeId}
              </code>
              {result.documentHash && (
                <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.85rem" }}>
                  Hash documento: <code style={{ wordBreak: "break-all" }}>{result.documentHash}</code>
                </p>
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
