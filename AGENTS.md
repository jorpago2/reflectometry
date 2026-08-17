# Reflectometry guidance

## Carbon y diseño

- Usa la versión instalada de `@carbon/react` y los patrones existentes del workspace.
- Usa Carbon de forma pragmática: no empeores la lectura de configuración, preview o resultados por seguir un componente.
- Consulta Storybook o la documentación oficial solo al introducir un componente, resolver una duda o sobrescribir estilos internos.
- Evalúa la interfaz renderizada: accesibilidad, foco, teclado, responsive y la diferencia entre preview, fit y resultados guardados.

## Propiedad de la interfaz y del cálculo

- React es propietario de los controles y la estructura que renderiza; el motor óptico y `fit-worker.ts` solo calculan y devuelven datos/progreso serializables.
- No añadas nuevas mutaciones directas del DOM, listeners globales ni handlers duplicados en componentes React.
- `multilayer-app.ts` es una frontera heredada: si se toca, conserva y centraliza el contrato de `scientific/dom-contract.ts`; no amplíes su renderizado imperativo a funcionalidades nuevas.
- El preview es una evaluación explícita, no un fit implícito. Conserva resultado obsoleto, progreso, cancelación y error; fit/bootstrap no deben mutar silenciosamente la configuración.
- Separa configuración, evaluación/preview, resultado del optimizador, incertidumbre y autosave/recuperación.

## `scientific-ui`

- Corrige primero los problemas específicos de reflectometry dentro de este repositorio.
- Modifica `scientific-ui` solo si la causa pertenece al componente compartido y la corrección debe propagarse.
- Al actualizarlo, cambia conjuntamente `package.json`, `pnpm-lock.yaml` y el tarball de `vendor/`; comprueba que el `.tgz` nuevo quede rastreado por Git.

## Camino rápido

- Atiende una familia concreta por iteración; no conviertas un ajuste del stack, preview, resultados o controles del optimizador en una auditoría general.
- Inspecciona el flujo afectado y entrega una iteración visible; amplía el alcance solo si el riesgo o el resultado lo justifican.
- Para cambios visuales localizados, comprueba el workspace y una resolución representativa. No ejecutes fits, bootstrap o validaciones numéricas amplias si el cambio es puramente visual.
- Mantén separadas la validez del modelo/optimización y la calidad visual; respeta unidades, orden de capas, rangos `n/k` y supuestos declarados.

## Subagentes

- Usa subagentes `gpt-5.6-luna` con razonamiento `max` en paralelo solo para partes independientes cuando mejore claramente velocidad, cobertura o calidad.
- Asigna alcances sin solapamiento, evita que editen el mismo archivo y revisa el diff/estado integrado antes de aceptar su trabajo.
- No uses subagentes para cambios pequeños, secuenciales o fuertemente acoplados.

## Verificación y comandos reales

- Para tareas visuales usa `$browser:control-in-app-browser` cuando esté disponible; inspecciona la pantalla renderizada antes y después.
- Reutiliza `pnpm dev` y HMR; usa `pnpm preview` solo para comprobar la salida de producción.
- Cambio visual/preview/fit: navegador interno y resolución relevante; `pnpm test:ui` cuando el escenario browser lo justifique.
- Cambio React/controlador: `pnpm typecheck` y pruebas afectadas; `pnpm test` ejecuta los tests Node de `tests/`.
- Cambio engine/worker/optimización: `pnpm test` y `pnpm typecheck`; comprueba límites, progreso, cancelación y errores.
- Cambio amplio o previo a publicar: `pnpm lint`, `pnpm test` y `pnpm build`.
- No declares verificaciones que no hayas ejecutado.
