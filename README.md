# Mercado Libre Analyzer Santi

Sistema para cotizar reparaciones de vehículos usando publicaciones de repuestos de Mercado Libre Argentina como evidencia de mercado.

## Qué hace

1. Carga el vehículo: marca, modelo, año, versión y motor.
2. Permite agregar múltiples piezas/daños dentro del mismo caso.
3. Genera varias búsquedas por pieza en Mercado Libre Argentina.
4. Deduplica publicaciones.
5. Consulta detalle actual de ítems mediante `/items/bulk`.
6. Consulta precio de venta actual mediante `/items/{id}/sale_price`.
7. Consulta compatibilidades de autopartes.
8. Exige originalidad/nuevo/compatibilidad antes de aceptar una publicación.
9. Calcula costo de compra confiable.
10. Aplica una política inicial configurable de cotización al cliente.
11. Calcula mano de obra por año:
    - chapa por día;
    - pintura por panel;
    - mecánica por hora.
12. Consolida repuestos + mano de obra + otros en un presupuesto.

## Estado

### V1 funcional en desarrollo

- [x] Arquitectura multi-pieza.
- [x] Motor de búsqueda.
- [x] Cliente real de Mercado Libre.
- [x] `/items/bulk` para detalle múltiple.
- [x] `sale_price` para precio vigente.
- [x] Catálogo de vehículos `MLA-CARS_AND_VANS`.
- [x] Lectura de compatibilidades de autopartes.
- [x] Reglas de originalidad/nuevo.
- [x] Compatibilidad como filtro obligatorio.
- [x] Motor robusto de precios.
- [x] Capa separada de precio al cliente.
- [x] Mano de obra por año.
- [x] UI integrada de repuestos + mano de obra.
- [x] Esquema SQL de Supabase.
- [x] CI con typecheck + production build.
- [ ] Automatización de navegador para el selector web cuando la API devuelve compatibilidad de catálogo resumida.
- [ ] Análisis visual de fotos para detectar piezas usadas disfrazadas de nuevas.
- [ ] Persistencia real en Supabase.
- [ ] PDF final de valuación.
- [ ] OAuth persistente/refresh token.

## Configuración

```bash
npm install
cp .env.example .env.local
npm run dev
```

La integración necesita un access token válido de Mercado Libre:

```env
MELI_ACCESS_TOKEN=...
```

Las credenciales nunca deben llegar al navegador.

## API interna

### `POST /api/analyze`

Entrada:

```json
{
  "vehicle": {
    "brand": "Peugeot",
    "model": "206",
    "year": 2013,
    "version": "1.4 Active 75cv",
    "engine": "1.4"
  },
  "damages": [
    {
      "id": "1",
      "partName": "Paragolpe",
      "position": "Trasero"
    }
  ]
}
```

Devuelve por pieza:

- publicaciones analizadas;
- precio actual;
- marca/OEM;
- compatibilidad;
- score;
- motivo de descarte;
- costo confiable;
- precio sugerido al cliente.

### `POST /api/vehicle-values`

Expone los valores del catálogo de vehículos para construir selectores Marca → Modelo → Año → Versión → Motor.

### `GET /api/health`

Indica si la aplicación está activa y si existe `MELI_ACCESS_TOKEN`.

## Mano de obra

Tarifas iniciales:

| Año | Chapa / día | Pintura / panel | Mecánica / hora |
| --- | ---: | ---: | ---: |
| 2015+ | $200.000 | $200.000 | $100.000 |
| 2010-2014 | $190.000 | $190.000 | $90.000 |
| 2002-2009 | $180.000 | $180.000 | $80.000 |
| <=2001 | $170.000 | $170.000 | $70.000 |

El ejemplo real Peugeot 206 año 2006 queda como caso de regresión:

```text
Repuestos: $1.600.000
Chapa: 3 × $180.000 = $540.000
Pintura: 6 × $180.000 = $1.080.000
Mecánica: 2 × $80.000 = $160.000
TOTAL: $3.380.000
```

## Documentación

- `docs/BUSINESS_RULES.md`
- `docs/COMPATIBILITY.md`
- `docs/LABOR_RATES.md`
- `docs/PRICING_CALIBRATION.md`
- `docs/REFERENCE_CASE_PEUGEOT_206_2013.md`

## Principio de seguridad del cálculo

Una publicación sólo puede entrar automáticamente al pricing si cumple:

```text
PIEZA CORRECTA
AND NUEVA
AND ORIGINAL/OEM
AND PRESENTACIÓN COMPARABLE
AND COMPATIBILIDAD CONFIRMADA
```

Si la compatibilidad queda `unknown`, se conserva el link pero no se usa el precio automáticamente.
