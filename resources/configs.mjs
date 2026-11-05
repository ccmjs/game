/** Independent standard demo of the game component. */
import { demoDefinition } from "./demo/definition.mjs";
export { demoDefinition };
export const demo = {
  engine:["ccm.load",new URL("../libs/game-engine/dist/game-engine-1.0.0.mjs",import.meta.url).href],
  renderer:["ccm.load",new URL("../libs/game-engine/dist/canvas-renderer-1.0.0.mjs",import.meta.url).href],
  audioModule:["ccm.load",new URL("../libs/game-engine/dist/audio-1.0.0.mjs",import.meta.url).href],
  css:["ccm.load",new URL("./demo/theme.css",import.meta.url).href],
  game:demoDefinition,autoStart:true,sound:true,
  plugins:[["ccm.load",new URL("./demo/actions.mjs",import.meta.url).href],["ccm.load",new URL("./demo/view.mjs",import.meta.url).href]],
  storage:{store:["ccm.store",{name:"ccm-game-saves"}],key:"orbit_workshop"},
};
