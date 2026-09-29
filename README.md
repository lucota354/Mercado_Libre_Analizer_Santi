# Mercado Libre Analyzer Santi

Sistema para cotizar reparaciones de vehículos usando publicaciones de repuestos de Mercado Libre Argentina como evidencia de mercado.

## Objetivo

Crear un presupuesto completo a partir de:

1. Vehículo: marca, modelo, año y versión.
2. Uno o más daños/repuestos.
3. Búsqueda de publicaciones de Argentina.
4. Filtro de compatibilidad, originalidad y condición.
5. Exclusión de alternativos, usados y resultados dudosos.
6. Cálculo robusto de precio de referencia por pieza.
7. Suma de repuestos + mano de obra + pintura + otros trabajos.
8. Conservación de links para auditoría.

> La unidad de trabajo es un **caso/presupuesto con N daños**, no una búsqueda individual.

## Estado actual

### V1 — Base iniciada

- [x] Arquitectura inicial.
- [x] Modelo de dominio para vehículos, daños y publicaciones.
- [x] Generador de búsquedas por pieza.
- [x] Reglas iniciales para original/nuevo.
- [x] Motor robusto de precio con descarte de outliers.
- [x] Interfaz inicial para cargar vehículo y múltiples daños.
- [x] Esquema SQL inicial para Supabase.
- [ ] OAuth de Mercado Libre.
- [ ] Búsqueda real en Mercado Libre Argentina.
- [ ] Consulta de detalles y precio actual por publicación.
- [ ] Compatibilidad exacta de autopartes.
- [ ] Análisis visual de fotos.
- [ ] Persistencia real en Supabase.
- [ ] Generación de presupuesto PDF.

## Reglas principales

- Solo Mercado Libre Argentina (site `MLA`).
- Si se pide original, "compatible con" o "tipo original" no alcanza.
- La marca del repuesto debe coincidir con la requerida o existir evidencia OEM suficiente.
- Una publicación declarada "nueva" puede ser descartada si texto o imágenes muestran uso.
- Se comparan productos equivalentes: unidad con unidad, kit con kit, par con par.
- Cada pieza conserva las publicaciones usadas para justificar el valor.
- Si no hay evidencia suficiente, el sistema devuelve "requiere revisión manual" y no inventa un precio.

Más detalle en `docs/BUSINESS_RULES.md`.

## Stack

- Next.js 16 + React 19
- TypeScript
- Supabase/PostgreSQL
- Mercado Libre API
- IA de texto/visión en etapas posteriores

## Ejecutar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir `http://localhost:3000`.

## Variables de entorno

Ver `.env.example`. Las credenciales de Mercado Libre nunca deben ir al frontend ni subirse al repo.

## Próximo paso

Conectar OAuth de Mercado Libre y reemplazar el modo de preparación de búsquedas por resultados reales de `MLA`, manteniendo el motor de validación desacoplado para poder probarlo sin depender de la API.
