# Reglas de mano de obra

Fuente inicial: reglas operativas y planilla real aportadas el 2026-09-29.

## Unidades

La mano de obra se calcula por tres unidades diferentes:

- **Chapa:** precio por día.
- **Pintura:** precio por panel.
- **Mecánica:** precio por hora.

No se deben mezclar estas unidades.

## Tarifas iniciales por año del vehículo

| Año del vehículo | Chapa / día | Pintura / panel | Mecánica / hora |
| --- | ---: | ---: | ---: |
| 2015 o posterior | $200.000 | $200.000 | $100.000 |
| 2010-2014 | $190.000 | $190.000 | $90.000 |
| 2002-2009 | $180.000 | $180.000 | $80.000 |
| 2001 o anterior | $170.000 | $170.000 | $70.000 |

### Nota de frontera 2010

La explicación verbal incluyó dos rangos que se superponen en 2010:

- 2010-2014;
- 2002-2010.

Para evitar una regla ambigua, la implementación inicial asigna **2010 al rango 2010-2014**. Las bandas son configurables y deben corregirse si futuros casos reales muestran otra regla.

### Vehículos muy antiguos

Para vehículos anteriores a 2002 se parte de $170.000 / $170.000 / $70.000, pero la regla humana indica que el **estado del vehículo** puede justificar un ajuste manual.

## Caso real de control: Peugeot 206 año 2006

La planilla de ejemplo usa:

```text
Repuestos de chapa:             $1.600.000
Repuestos mecánica y otro:      $0

Chapa:     3 días × $180.000 =   $540.000
Pintura:   6 paneles × $180.000 = $1.080.000
Mecánica:  2 horas × $80.000 =   $160.000

TOTAL = $3.380.000
```

Este caso debe mantenerse como test/regresión de negocio.

## Tiempo de reparación

La planilla también separa horas estimadas:

```text
Chapa:      13,5 h
Pintura:    14 h
Mecánica:    2 h
Total:      29,5 h
```

Con 6 horas hábiles por día:

```text
29,5 / 6 = 4,9167 días
≈ 4,9 días hábiles
```

La valuación puede agregar:

- fines de semana;
- espera de turno/búsqueda de taller;
- demora de repuestos.

Estos tiempos no deben confundirse con el precio por día de chapa.

## Estructura de valuación

La salida debe permitir:

```text
REPUESTOS DE CHAPA
REPUESTOS DE MECÁNICA Y OTRO
MANO DE OBRA CHAPA       [días]
MANO DE OBRA PINTURA     [paneles]
MANO DE OBRA MECÁNICA    [horas]
OTROS
TOTAL
```

Además debe guardar la tarifa aplicada y la banda de año para que el cálculo sea auditable.
