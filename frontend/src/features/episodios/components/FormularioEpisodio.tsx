import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSesion } from "@/shared/auth/SessionContext";
import type { EpisodioPayload } from "@/shared/types/episodio";
import { toDateTimeLocal } from "@/shared/utils/episodioPayload";
import { ErroresValidacion } from "./ErroresValidacion";

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
  startTime: "08:00",
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

  useEffect(() => {
    if (sesion?.ipsId) {
      setValue("prestadorOrigen.identifier.0.value", sesion.ipsId, {
        shouldDirty: false
      });
    }
  }, [sesion?.ipsId, setValue]);

  const currentIps = useWatch({
    control,
    name: "prestadorOrigen.identifier.0.value"
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
      className="form-section form-section--stacked"
      noValidate
      aria-label="Formulario de episodio clínico (HCE urgencias)"
    >
      <div className="form-summary">
        <div>
          <strong>Quién registra</strong>
          <span>{sesion?.nombre ?? "Usuario autenticado requerido"}</span>
        </div>
        <div>
          <strong>IPS</strong>
          <span>{currentIps || sesion?.ipsId || "Debe indicar la IPS origen"}</span>
        </div>
        <div>
          <strong>Resultado esperado</strong>
          <span>Documento clínico validado, hash y trazabilidad del episodio</span>
        </div>
      </div>

      <fieldset className="form-card" aria-describedby="paciente-desc">
        <legend>1. Datos básicos del paciente</legend>
        <span id="paciente-desc" className="visually-hidden">
          Información mínima para identificar al paciente atendido.
        </span>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="patient-identifier" className="form-label form-label--required">
              Documento o identificador
            </label>
            <input
              id="patient-identifier"
              type="text"
              className="form-input"
              {...register("patient.identifier.0.value", { required: true })}
              aria-required="true"
              aria-invalid={Boolean(errors.patient?.identifier?.[0]?.value)}
            />
            <span className="form-hint">Ejemplo: 12345678</span>
            {errors.patient?.identifier?.[0]?.value && (
              <span className="form-error" role="alert">
                Este dato es obligatorio.
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="patient-family" className="form-label form-label--required">
              Apellido
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
              Nombre
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
              Fecha de nacimiento
            </label>
            <input
              id="patient-birthDate"
              type="date"
              className="form-input form-input--date"
              {...register("patient.birthDate", { required: true })}
            />
            {errors.patient?.birthDate && (
              <span className="form-error" role="alert">
                La fecha de nacimiento es obligatoria.
              </span>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-card">
        <legend>2. Datos de la atención</legend>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="startDate" className="form-label form-label--required">
              Inicio de la atención
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
                {...register("startTime")}
                aria-label="Hora de inicio"
              />
            </div>
            {errors.startDate && (
              <span className="form-error" role="alert">
                Debe indicar la fecha de inicio.
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="endDate" className="form-label">
              Fin de la atención
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
            <span className="form-hint">Déjelo vacío si la atención sigue en curso.</span>
          </div>

          <div className="form-group">
            <label htmlFor="encounter-class" className="form-label form-label--required">
              Tipo de atención
            </label>
            <input
              id="encounter-class"
              type="text"
              className="form-input"
              {...register("encounter.class.coding.0.code", { required: true })}
            />
            <span className="form-hint">Ejemplo habitual: EMER</span>
          </div>

          <div className="form-group">
            <label htmlFor="prestador-reps" className="form-label form-label--required">
              IPS origen
            </label>
            <input
              id="prestador-reps"
              type="text"
              className="form-input"
              {...register("prestadorOrigen.identifier.0.value", { required: true })}
              readOnly={Boolean(sesion?.ipsId)}
            />
            <span className="form-hint">
              {sesion?.ipsId
                ? "Se completó automáticamente con la IPS de su sesión."
                : "Indique el código REPS o identificador institucional."}
            </span>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-card">
        <legend>3. Diagnóstico principal</legend>
        <div className="form-columns">
          <div className="form-group">
            <label htmlFor="diagnostico-cie10" className="form-label form-label--required">
              Código CIE-10
            </label>
            <input
              id="diagnostico-cie10"
              type="text"
              className="form-input"
              {...register("diagnosticoIngreso.code.coding.0.code", { required: true })}
            />
            <span className="form-hint">Ejemplo: A09</span>
          </div>
        </div>
      </fieldset>

      <div className="form-toolbar">
        <div>
          <strong>Antes de enviar</strong>
          <p>
            Puede validar la estructura primero o registrar directamente si ya tiene toda la
            información clínica lista.
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
