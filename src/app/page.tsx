"use client";

import { useMemo, useState } from "react";
import { createSearchPlan } from "@/lib/marketplace/search-plan";
import type { DamageInput, VehicleInput } from "@/lib/domain/types";

const emptyVehicle: VehicleInput = {
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  version: "",
  engine: ""
};

const newDamage = (): DamageInput => ({
  id: crypto.randomUUID(),
  partName: "",
  position: "",
  notes: ""
});

export default function HomePage() {
  const [vehicle, setVehicle] = useState<VehicleInput>(emptyVehicle);
  const [damages, setDamages] = useState<DamageInput[]>([newDamage()]);
  const [prepared, setPrepared] = useState(false);

  const plans = useMemo(
    () =>
      prepared
        ? damages
            .filter((damage) => damage.partName.trim())
            .map((damage) => createSearchPlan(vehicle, damage))
        : [],
    [prepared, vehicle, damages]
  );

  const updateDamage = (id: string, patch: Partial<DamageInput>) => {
    setPrepared(false);
    setDamages((current) =>
      current.map((damage) => (damage.id === id ? { ...damage, ...patch } : damage))
    );
  };

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">V1 · Cotizador de repuestos</span>
        <h1>Mercado Libre Analyzer Santi</h1>
        <p>
          Cargá un vehículo y todos los daños del caso. El sistema investiga cada pieza,
          exige compatibilidad con el vehículo y luego consolida un único presupuesto.
        </p>
      </section>

      <section className="card">
        <div className="sectionTitle">
          <div>
            <span className="step">01</span>
            <h2>Vehículo</h2>
          </div>
          <span className="badge">Argentina · MLA</span>
        </div>

        <div className="grid vehicle">
          <label>
            Marca
            <input
              placeholder="Peugeot"
              value={vehicle.brand}
              onChange={(event) => {
                setPrepared(false);
                setVehicle({ ...vehicle, brand: event.target.value });
              }}
            />
          </label>
          <label>
            Modelo
            <input
              placeholder="206"
              value={vehicle.model}
              onChange={(event) => {
                setPrepared(false);
                setVehicle({ ...vehicle, model: event.target.value });
              }}
            />
          </label>
          <label>
            Año
            <input
              type="number"
              value={vehicle.year}
              onChange={(event) => {
                setPrepared(false);
                setVehicle({ ...vehicle, year: Number(event.target.value) });
              }}
            />
          </label>
          <label>
            Versión
            <input
              placeholder="1.4 Active 75cv"
              value={vehicle.version ?? ""}
              onChange={(event) => {
                setPrepared(false);
                setVehicle({ ...vehicle, version: event.target.value });
              }}
            />
          </label>
          <label>
            Motor
            <input
              placeholder="1.4"
              value={vehicle.engine ?? ""}
              onChange={(event) => {
                setPrepared(false);
                setVehicle({ ...vehicle, engine: event.target.value });
              }}
            />
          </label>
        </div>

        <p className="helper">
          Estos datos se usarán también para el verificador de compatibilidad de Mercado Libre:
          Marca → Modelo → Año → Versión → Motor.
        </p>
      </section>

      <section className="card">
        <div className="sectionTitle">
          <div>
            <span className="step">02</span>
            <h2>Daños / repuestos</h2>
          </div>
          <button className="secondary" onClick={() => setDamages([...damages, newDamage()])}>
            + Agregar pieza
          </button>
        </div>

        <div className="damageList">
          {damages.map((damage, index) => (
            <article className="damage" key={damage.id}>
              <div className="damageHeader">
                <strong>Pieza {index + 1}</strong>
                {damages.length > 1 && (
                  <button
                    className="linkButton"
                    onClick={() => {
                      setPrepared(false);
                      setDamages(damages.filter((item) => item.id !== damage.id));
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div className="grid three">
                <label>
                  Repuesto
                  <input
                    placeholder="Paragolpe"
                    value={damage.partName}
                    onChange={(event) => updateDamage(damage.id, { partName: event.target.value })}
                  />
                </label>
                <label>
                  Posición
                  <input
                    placeholder="Trasero"
                    value={damage.position ?? ""}
                    onChange={(event) => updateDamage(damage.id, { position: event.target.value })}
                  />
                </label>
                <label>
                  Observaciones
                  <input
                    placeholder="Roto por impacto"
                    value={damage.notes ?? ""}
                    onChange={(event) => updateDamage(damage.id, { notes: event.target.value })}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <button
          className="primary"
          disabled={!vehicle.brand || !vehicle.model || damages.every((damage) => !damage.partName)}
          onClick={() => setPrepared(true)}
        >
          Preparar búsquedas
        </button>
      </section>

      {plans.length > 0 && (
        <section className="card">
          <div className="sectionTitle">
            <div>
              <span className="step">03</span>
              <h2>Plan de investigación</h2>
            </div>
            <span className="badge amber">API pendiente de conectar</span>
          </div>

          <div className="planGrid">
            {plans.map((plan) => (
              <article className="plan" key={plan.damageId}>
                <h3>{plan.displayName}</h3>
                <p className="muted">Se ejecutarán variantes para no depender de un solo título.</p>
                <ol>
                  {plan.queries.map((query) => (
                    <li key={query}>{query}</li>
                  ))}
                </ol>
                <div className="rules">
                  <span>✓ Argentina</span>
                  <span>✓ Original/OEM</span>
                  <span>✓ Nuevo</span>
                  <span>✓ Compatible confirmado</span>
                  <span>✓ Links auditables</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="notice">
        <strong>Regla crítica:</strong> si la compatibilidad con el vehículo queda como desconocida
        o Mercado Libre indica “No es compatible”, esa publicación no entra en el cálculo
        automático del presupuesto.
      </section>
    </main>
  );
}
