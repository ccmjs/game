# ccmjs Game

A configurable 2D game component for **ccmjs 28**, inspired by the approachable model of **GameMaker 8.1**: sprites, object definitions, placed instances, rooms, events and ordered actions.

The game runs with **JavaScript, Canvas 2D, HTML and CSS**, rendering both **PNG and SVG** graphics. The component loads the versioned output of the local **Game Engine** module package through `ccm.load`. No package installation or build step is required to run the checked-out demo. The included [Orbitwerkstatt showcase](resources/demo/README.md) demonstrates the component with a small, self-contained game.

## Run the demo

Serve this repository with any static HTTP server and open `index.html`. For example:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`. ES modules must be served over HTTP rather than opened through a `file:` URL. The bundled ccmjs framework and showcase SVG art are local: the demo does not require a CDN or a third-party game service.

Open [index.html](index.html) for the interactive showcase. Its configuration is [resources/configs.mjs](resources/configs.mjs); the game-specific definition, sprites and behavior live in `resources/demo/`.

## Showcase: Orbitwerkstatt

Guide a repair drone through **Ladestation** and **Spiegelgarten**, collect the energy cells and reach each room's portal. Click or tap a destination for automatic navigation, or steer with the arrow keys/WASD. Select **Impuls** or press **E** to open a nearby gate or briefly disable a patrol; the pulse has a four-second recharge time.

The example combines two rooms, animated SVG sprites, placed object instances, collectible collisions, score, alarm-driven gates, keyboard and pointer input, tool commands and synthetic sound effects. The component adds pause, fullscreen, restart and manual save/load. Its game definition and named action/rendering plugins remain separate from the reusable component and engine.

## Embed

```html
<script src="./libs/framework/ccm-28.0.0.min.js"></script>
<div id="game"></div>
<script type="module">
  const app = await ccm.start(
    "./ccm.game.mjs",
    ["ccm.load", "./resources/configs.mjs#demo"],
    document.getElementById("game")
  );
</script>
```

The example loads the included showcase through `resources/configs.mjs`. A different game supplies its own `game` and `plugins` configuration; the component does not import game-specific rules or assets.

Starting `ccm.game.mjs` without a configuration runs a small bouncing-orb game.

## Component configuration

| Property | Purpose |
| --- | --- |
| `engine` | Loaded module exporting `GameRuntime` and `validateDefinition`; defaults to the pinned Game Engine core. |
| `renderer` | Loaded module exporting `CanvasRenderer`; replaceable independently of the simulation. |
| `audioModule` | Loaded module exporting `GameAudio`; `app.audio` remains the live audio instance. |
| `game` | Serializable game definition: sprites, objects, rooms, event/action lists, rules and UI text. |
| `plugins` | Explicitly loaded modules providing named actions, optional rendering hooks and a read-only cursor hook. |
| `storage` | Optional `{ store, key }` CCM datastore binding. Set to `false` to hide persistence controls. |
| `autoStart` | Start simulation immediately; `false` starts paused. |
| `sound` | Initial sound setting. Off by default; playback starts after a user gesture. |
| `extensions` | CCM callbacks receiving `{ app, type }`. |
| `src` | Optional configuration object for integration with existing Makerspace preview conventions. |

Default storage is an offline CCM datastore backed by IndexedDB. It keeps one save slot per game in the current browser. An embedding app can supply a different accessor and a valid CCM dataset key, including a remote authenticated datastore. Save operations happen on request, not on every animation frame. For an editor preview, use `storage: false` or a separate temporary store/key.

Game definitions, live state and saved snapshots are separate. Every runtime owns its mutable state. Snapshots contain game ID, game version and schema version; incompatible saves are rejected before changing the running game. Advance `game.version` when changing rules or level data incompatibly.

## Local engine module package

The engine source, tests, build script and native browser example live together in `libs/game-engine/` inside this repository. Its core knows neither CCM nor the DOM: it accepts a game definition and synchronous plugins, advances simulation time, and produces snapshots. Canvas drawing and Web Audio are separate optional modules. The component supplies browser lifecycle, input routing, the HTML controls and CCM storage. This boundary allows a later extraction into a separate repository without requiring one now.

The component uses the checked-in **1.0.0** artifacts under `libs/game-engine/dist/`:

- `game-engine-1.0.0.mjs`: `GameRuntime` and `validateDefinition`.
- `canvas-renderer-1.0.0.mjs`: `CanvasRenderer`.
- `audio-1.0.0.mjs`: `GameAudio`.

All three dependencies are configured through `ccm.load`. Another compatible module can replace each dependency without hard-coding it in the component. The library's [README](libs/game-engine/README.md) describes its public API and standalone usage; [this component's format guide](docs/game-format.md) explains the game definition together with CCM UI and storage integration. `libs/game-engine/dist/release.json` records the artifact version and SHA-256 values.

Tool sprite previews use the renderer's public `drawSpritePreview(canvas, spriteId)` method after asset loading. The component does not inspect decoded images or atlas rectangles. Custom renderers can implement this optional method to draw toolbar artwork; without it, tool labels and controls remain usable.

Edit the source under `libs/game-engine/src/`, rebuild the local artifacts, and run all tests from the repository root:

```sh
npm --prefix libs/game-engine run build
npm --prefix tests test
```

To run only the library's tests, use `npm --prefix libs/game-engine test`. Builds use Node.js built-ins and do not install dependencies or download files. The component release workflow packages the selected source and artifacts; it does not rebuild the engine automatically. When changing the package version, update the configured module URLs and direct imports to the new artifact names. Library version numbers are separate from game IDs, `game.version` and the snapshot schema.

## GameMaker-inspired model

- **Sprites:** independent images/animation frames, dimensions and frame rate; image URLs, inline SVG, or source rectangles from a shared PNG atlas.
- **Objects:** reusable templates, default properties, collision dimensions, sprite, depth and events.
- **Instances:** independent objects placed in rooms or created by actions; positions use pixels with a central origin.
- **Rooms:** dimensions, background, square tile grid, tile definitions, placed instances and custom room properties.
- **Events:** Create/Destroy, Begin Step/Step/End Step, alarms, collision, pointer, keyboard, room entry/exit and custom commands.
- **Actions:** set/add values, conditions, motion, creation/destruction, sprite changes, alarms, room transitions, score, finish, notifications and registered custom actions.

Rules use data expressions instead of JavaScript strings or `eval`. For example:

```js
const object = {
  sprite: "walker",
  properties: { health: 3 },
  events: {
    create: [{ type: "velocity", vx: 80 }],
    "collision:wall": [{ type: "reverse", axis: "x" }],
    pointerDown: [
      { type: "add", path: "health", value: -1 },
      {
        type: "if",
        condition: { op: "lte", args: [{ ref: "self.health" }, 0] },
        then: [{ type: "destroy" }]
      }
    ]
  }
};
```

The engine implements its own web runtime, **not a GML interpreter or a GameMaker project importer**. It uses explicit simulation seconds for movement and alarms (`steps` is also accepted for alarms). Generic collision uses axis-aligned rectangles and solid tiles. Pixel masks, a physics solver, path/timeline editors, object inheritance and custom Draw-event action lists are not included. Drawing extensions and sprite animation cover the demo's visuals.

The full format and API are documented in [docs/game-format.md](docs/game-format.md).

## View and pointer feedback

**Vollbild** fits the entire room into the available screen area while preserving its aspect ratio. The fullscreen view has no playfield scrollbars; normal zoom is retained and restored on exit. The component uses the native Fullscreen API when available and falls back to a viewport-filling layout if the embedding browser rejects it. Escape or **Vollbild beenden** exits. Narrow or short displays use a compact tool selector so every tool remains available.

A game plugin can export `cursor(runtime, { x, y })`, returning a CSS cursor string for the current logical room coordinates or `undefined` to defer. The component refreshes the result after state/tool changes even when the pointer is stationary. The hook must not mutate the game. Pause, completed games and pointer exit use the normal cursor; game-specific action eligibility belongs in the plugin. See [the hook contract](docs/game-format.md#kontextabhängiger-mauszeiger).

## Audio

The component provides native Web Audio playback, separate music/effect volume controls, gesture-based activation and configurable cue variants. Pause freezes music playback; resuming continues at the same position. Restart and room changes rewind music; loading a save remains paused. Audio configuration is described in [the game format](docs/game-format.md#musik-und-soundeffekte).

## Public instance API

```js
app.pause();
app.resume();
app.step();                    // Pause and advance one simulation step.
app.command("tool", { tool: "select" });
await app.setFullscreen(true); // Native fullscreen, with viewport fallback.
await app.setFullscreen(false); // Restore the normal zoom/scroll view.
const snapshot = app.getValue(); // Detached, serializable state.
app.loadState(snapshot);       // Validate, restore, and stay paused.
await app.save();              // Write to the configured CCM datastore.
await app.load();
await app.start();             // Fresh game; does not overwrite a saved game.
app.stop();                    // Cancel frame loop, listeners and audio resources.
await app.destroy();           // Await audio cleanup and notify extensions.
```

`app.state` exposes the live logical state following current ccmjs conventions. `app.gui` is transient UI state, including `fullscreen` and `fullscreenMode` (`"native"`, `"viewport"` or `null`). `setFullscreen(true, { native: false })` explicitly selects the viewport layout; fullscreen settings are never persisted in game snapshots. Extension events: `init`, `ready`, `before-start`, `start`, `pause`, `resume`, `save`, `load`, `finish`, `destroy`. Loading a completed save displays its result without emitting another completion event. Temporary DOM removal suspends the loop while preserving the runtime and controls; reattachment resumes it unless manually paused. The host must call `stop()` or `destroy()` when retiring an instance to release listeners and decoded assets.

## Tests

Node.js 22 or newer is needed for tests and local engine builds. The test-only npm configuration lives in `tests/package.json`; no package file is needed at the repository root. Run the component, showcase and engine tests together from the repository root:

```sh
npm --prefix tests test
# Equivalent explicit command:
node --test tests/*.test.mjs libs/game-engine/tests/*.test.mjs
```

Component tests cover dependency injection, instance isolation, lifecycle races, persistence, controls and cleanup. The local library package owns the engine, Canvas renderer and audio unit tests under `libs/game-engine/tests/`; the combined test command includes them. Showcase tests exercise its game flow and saved-state compatibility. Additional games own their test suites alongside their implementation.

[tests/browser.html](tests/browser.html) exercises the showcase through real CCM instances, Canvas rendering and browser persistence.

Open [tests/lifecycle-browser.html](tests/lifecycle-browser.html) through the static server to check tab-return recovery, manual pause, discarded animation callbacks, page-cache return and temporary removal from the DOM/CCM Shadow DOM. Focus and visibility events are simulated explicitly; Canvas and DOM operations use the real browser.

[tests/fullscreen-browser.html](tests/fullscreen-browser.html) checks fitted fullscreen geometry, scroll-free layout, aspect ratio, pointer coordinates and game-owned cursor feedback. Its native-fullscreen button requires a real browser click.

The showcase's [documentation](resources/demo/README.md) describes its controls, game rules and configuration.

## Release build

The repository uses the standard `ccmjs/component-release` workflow in `.github/workflows/tag.yml`. It packages the component entry point together with `resources/` and `libs/`, including the public configuration at `resources/configs.mjs`, the showcase under `resources/demo/` and the local engine artifacts. HTML demo and browser-test pages are local development views; copying their files does not publish a standalone website. Embed a release through its versioned component entry point and `resources/configs.mjs#demo`.

A local dry-run build can be prepared with a checkout of the release tooling; the output directory must not already exist:

```sh
node ../component-release/scripts/build.mjs --source . --output /tmp/game-release --repository ccmjs/game
```

This prepares files without publishing a tag. The workflow's dry-run mode can also validate the release.

## Files

| File | Responsibility |
| --- | --- |
| `ccm.game.mjs` | CCM lifecycle, HTML interface, fixed timestep, input and persistence. |
| `libs/game-engine/` | Independent local module package: source, tests, build script, example and license. |
| `libs/game-engine/dist/` | Versioned engine, Canvas/audio modules and artifact checksums used by the component. |
| `resources/styles.css` | Isolated responsive component styles. |
| `resources/demo/` | Showcase definition, original SVG sprites, behavior and documentation. |
| `resources/configs.mjs` | Public showcase configuration and dependency bindings. |
| `tests/` | Test-only npm configuration, component integration, dependency injection and lifecycle tests. |
| `docs/game-format.md` | Game-definition reference and CCM integration, linked to the independent library API. |
| `index.html` | Interactive showcase page. |

## References

- [ccmjs framework and conventions](https://github.com/ccmjs/framework/wiki)
- [GameMaker: objects and instances](https://manual.gamemaker.io/monthly/en/Quick_Start_Guide/Objects_And_Instances.htm)
- [GameMaker: object events](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Object_Properties/Object_Events.htm)

MIT License. Bundled dependencies retain their respective license files. Showcase sprites are original SVG artwork defined with the example.
