"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("UI error:", error);
  }, [error]);

  return (
    <main className="fatalErrorShell">
      <section className="fatalErrorCard">
        <span className="eyebrow">Mercado Libre Analyzer Santi</span>
        <h1>No pudimos completar esta pantalla</h1>
        <p>
          La información que estabas cargando produjo un error inesperado. Podés
          reintentar sin cerrar el navegador.
        </p>
        <button className="primary" type="button" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}
