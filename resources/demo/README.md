# Orbitwerkstatt

An original, independent example for the configurable game component. A friendly repair drone restores two space-station decks by collecting energy cells and reaching the portal.

## Play

Serve the repository over HTTP and open its root `index.html`. Tap/click a cell or floor destination for automatic navigation, or use arrow keys / WASD for direct control. **Impuls**, **2** or **E** opens nearby gates and temporarily stops patrol drones. It recharges in four seconds. All energy cells unlock the exit; the first result offers the next deck. Sentinel contact costs five points but never ends the run.

## What the example demonstrates

- Two rooms, a square collision grid, object templates and distinct instances.
- Original locally generated SVG frames for a robot, energy, gate and portal.
- Declarative collision actions for score, collection, effects and completion.
- Native alarm events for gate cycles and temporary effects.
- Mouse/touch navigation and keyboard controls via a small game-owned action module.
- A read-only drawing module for lights, route preview and the pulse effect.
- Synthesized Web Audio effects, fullscreen, pause and CCM save/load without external assets or services.

`../configs.mjs` exports the ready-to-use `demo` configuration and `demoDefinition`. `definition.mjs` holds the serializable game model; `art.mjs` defines the SVG frames; `actions.mjs` provides navigation and timing behaviours; `view.mjs` draws cosmetic additions. `theme.css` imports the component stylesheet and gives this demo its own appearance. The engine and component do not import these game modules.

The graphics are original vector artwork defined in source code and licensed with the repository. No external images, fonts, npm packages or network APIs are required.
