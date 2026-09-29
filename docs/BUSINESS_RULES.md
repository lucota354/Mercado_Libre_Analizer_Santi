# Reglas de negocio

## 1. El presupuesto es multi-pieza

Ejemplo:
- Paragolpe trasero roto.
- Luneta trasera rota.
- Óptica derecha dañada.

Cada pieza se investiga de forma independiente y luego se suma en el mismo presupuesto.

## 2. Mercado

Solo se usan publicaciones correspondientes a Argentina / Mercado Libre Argentina (MLA).

## 3. Compatibilidad obligatoria

Una publicación **no entra en el cálculo automático** hasta que la compatibilidad con el vehículo del caso esté confirmada.

El vehículo se identifica como mínimo por:

- Marca.
- Modelo.
- Año.
- Versión.

Cuando esté disponible también se usa:

- Motor.
- Carrocería.
- Transmisión.
- ID de producto del catálogo de vehículos.

Estados internos:

- `compatible`: puede continuar con los demás filtros.
- `incompatible`: descartar.
- `unknown`: no usar en el precio automático; requiere verificación adicional o revisión manual.

Si Mercado Libre muestra **"No es compatible con tu vehículo"**, el resultado se descarta aunque el repuesto sea original, nuevo y tenga buen precio.

### Fuentes de evidencia

1. Compatibilidades detalladas expuestas por la API.
2. Notas y restricciones de posición.
3. Selector de compatibilidad de la publicación como fallback cuando la API no expone detalle suficiente.
4. Confirmación manual como último recurso.

No se debe inferir compatibilidad únicamente porque el modelo aparezca en el título.

### Compatibilidades del catálogo

Mercado Libre puede devolver compatibilidades creadas por el vendedor con detalle de vehículo. Para compatibilidades administradas por el catálogo puede devolver información resumida. Cuando no exista suficiente detalle para confirmar el vehículo exacto, se debe usar el fallback del selector de la publicación o dejar el resultado como `unknown`.

### Restricciones y reputación

También validar:

- posición de instalación;
- notas especiales;
- restricciones de versión;
- nivel de reputación de compatibilidad.

Una compatibilidad con nivel `RED` por reclamos de incompatibilidad no entra automáticamente al cálculo.

## 4. Originalidad estricta

Si el requerimiento es "original Renault", "original Peugeot", etc.:

### Señales positivas
- atributo de marca coincide;
- número OEM verificable;
- texto original/genuino;
- etiqueta/packaging visible, cuando exista análisis visual.

### Señales negativas
- genérico;
- alternativo;
- tipo original;
- símil original;
- marca distinta.

La frase "compatible con Peugeot" describe compatibilidad, no demuestra que la marca de la pieza sea Peugeot.

## 5. Condición

La pieza debe estar nueva.

Se descarta o revisa manualmente cuando:
- la publicación indica usado;
- la descripción habla de desarme, reparación o repintado;
- las imágenes muestran marcas de instalación, rayones, suciedad, desgaste, óxido o reparaciones.

## 6. Comparables

No mezclar:
- unidad con par;
- pieza sola con kit;
- pieza pelada con conjunto completo;
- generaciones/años incompatibles;
- lado derecho con izquierdo;
- delantero con trasero.

## 7. Precio de referencia

Solo se usan candidatos que pasaron **todos** los filtros, incluida compatibilidad.

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

## 8. Estructura del presupuesto

El presupuesto debe poder representar el formato habitual de taller:

1. Lista de repuestos.
2. Subtotal repuestos.
3. Mano de obra.
4. Pintura.
5. Subtotal chapa y pintura.
6. Otros trabajos/insumos.
7. Total general.

Ejemplo de referencia aportado para el proyecto:

```text
CHAPA Y PINTURA  $1.100.000
REPUESTOS        $2.600.000
TOTAL            $3.700.000
```

La lista puede tener 2 piezas o decenas de piezas y el cálculo debe funcionar igual.

## 9. Auditoría

Por cada pieza guardar:

- item ID;
- título;
- precio observado;
- moneda;
- link;
- marca;
- condición;
- OEM;
- compatibilidad y fuente de la verificación;
- vehículo compatible encontrado;
- nota/restricción;
- reputación de compatibilidad;
- evaluación;
- motivo de descarte;
- fecha/hora.

## 10. Insuficiencia de datos

Nunca inventar un precio. Si no hay candidatos de calidad suficientes:

**Estado: requiere revisión manual.**

## 11. Daños relacionados

En V2/V3 el sistema sugerirá componentes a revisar, por ejemplo ante un paragolpe trasero:
- alma/refuerzo;
- absorbedor;
- soportes;
- sensores;
- reflectores;
- molduras;
- grampas.

Estas sugerencias no entran al presupuesto hasta que el usuario las confirme.
