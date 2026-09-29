# Arquitectura

## Principio principal

El sistema modela un **caso de reparación**. Un caso tiene un vehículo y uno o más daños. Cada daño genera su propia investigación de mercado y todos los resultados válidos se consolidan en un presupuesto.

```text
Caso
 ├── Vehículo
 ├── Daño 1 -> búsquedas -> candidatos -> evaluación -> precio referencia
 ├── Daño 2 -> búsquedas -> candidatos -> evaluación -> precio referencia
 └── Presupuesto
      ├── repuestos
      ├── mano de obra
      ├── pintura
      └── otros
```

## Pipeline V1

1. Crear caso.
2. Cargar marca, modelo, año y versión.
3. Cargar N piezas dañadas.
4. Normalizar cada nombre.
5. Generar 3-5 queries por pieza.
6. Buscar en Mercado Libre Argentina.
7. Deduplicar por item ID.
8. Obtener detalle de publicaciones.
9. Evaluar pieza correcta, marca/originalidad, condición, equivalencia y compatibilidad.
10. Conservar candidatos válidos.
11. Calcular referencia con outlier filtering.
12. Crear presupuesto consolidado.
13. Guardar publicaciones y links que justifican cada valor.

## Capas

### UI
Next.js App Router. La UI no conoce secretos de Mercado Libre.

### Application/domain
Reglas determinísticas para búsquedas, validación y precios. Deben poder probarse con datos simulados.

### Marketplace adapter
Única capa que conoce la API de Mercado Libre. Esto evita acoplar reglas de negocio a cambios de endpoints.

### AI enrichment
Etapa posterior:
- análisis de fotos de publicaciones;
- detección de señales de uso;
- lectura de etiquetas/códigos OEM;
- sugerencia de daños relacionados;
- análisis opcional de fotos del vehículo.

### Persistence
Supabase/Postgres para casos, vehículos, daños, resultados, evaluaciones y presupuestos.

## Seguridad

- OAuth solo backend.
- No persistir secretos en el repositorio.
- No enviar access tokens al browser.
- Registrar fecha de consulta y URL de cada publicación.
- No asumir que un precio viejo sigue vigente.

## Estrategia ante cambios de Mercado Libre

Mantener endpoints dentro de un adapter. La lógica de originalidad, condición, compatibilidad y pricing no debe depender de la forma exacta de la respuesta de Mercado Libre.
