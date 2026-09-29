# Reglas de negocio

## 1. El presupuesto es multi-pieza

Ejemplo:
- Paragolpe trasero roto.
- Luneta trasera rota.
- Óptica derecha dañada.

Cada pieza se investiga de forma independiente y luego se suma en el mismo presupuesto.

## 2. Mercado

Solo se usan publicaciones correspondientes a Argentina / Mercado Libre Argentina (MLA).

## 3. Originalidad estricta

Si el requerimiento es "original Renault", "original Peugeot", etc.:

### Señales positivas
- atributo de marca coincide;
- número OEM verificable;
- texto original/genuino;
- etiqueta/packaging visible, cuando exista análisis visual.

### Señales negativas
- genérico;
- alternativo;
- compatible con;
- tipo original;
- símil original;
- marca distinta.

"Compatible con Peugeot" no equivale a "marca Peugeot".

## 4. Condición

La pieza debe estar nueva.

Se descarta o revisa manualmente cuando:
- la publicación indica usado;
- la descripción habla de desarme, reparación o repintado;
- las imágenes muestran marcas de instalación, rayones, suciedad, desgaste, óxido o reparaciones.

## 5. Comparables

No mezclar:
- unidad con par;
- pieza sola con kit;
- pieza pelada con conjunto completo;
- generaciones/años incompatibles;
- lado derecho con izquierdo;
- delantero con trasero.

## 6. Precio de referencia

Solo se usan candidatos que pasaron los filtros.

- 1 resultado válido: confianza baja y revisión manual recomendada.
- 2-3 resultados: referencia posible, mostrando rango.
- 4+ resultados: aplicar detección de outliers y usar mediana como referencia.
- Valores extremos no deben arrastrar el presupuesto.

Ejemplo:

```text
$585.000
$600.000
$620.000
$640.000
$650.000
$1.380.000 -> outlier
```

## 7. Auditoría

Por cada pieza guardar item ID, título, precio observado, moneda, link, marca, condición, OEM, evaluación, motivo de descarte y fecha/hora.

## 8. Insuficiencia de datos

Nunca inventar un precio. Si no hay candidatos de calidad suficientes:

**Estado: requiere revisión manual.**

## 9. Daños relacionados

En V2/V3 el sistema sugerirá componentes a revisar, por ejemplo ante un paragolpe trasero:
- alma/refuerzo;
- absorbedor;
- soportes;
- sensores;
- reflectores;
- molduras;
- grampas.

Estas sugerencias no entran al presupuesto hasta que el usuario las confirme.
