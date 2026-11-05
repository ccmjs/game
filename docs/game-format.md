# Spielkonfiguration und Runtime

`game` ist eine ccmjs-Komponente für datengetriebene 2D-Spiele. Das Modell orientiert sich an dem aus GameMaker 8.1 bekannten Zusammenspiel von **Sprites, Objekten, Instanzen, Räumen, Ereignissen und Aktionen**. Es handelt sich um ein eigenes Webformat: GameMaker-Projektdateien und GML werden nicht ausgeführt.

Die Engine, die Komponente, die Spieldefinition und ein gespeicherter Spielstand sind unterschiedliche Dinge:

- Die **Engine** ist das lokale, eigenständig nutzbare Modulpaket unter `libs/game-engine/`. Ihr Simulationskern kennt weder CCM noch die Browseroberfläche; Canvas-Darstellung und Web Audio sind getrennte optionale Module.
- Die **Komponente** lädt diese Module über `ccm.load` und verbindet sie mit Bedienoberfläche, Eingaben, Browserlebenszyklus und CCM-Datastore.
- Die **Spieldefinition** unter `config.game` enthält Räume, Objektvorlagen und Regeln.
- Der **Spielstand** enthält den aktuellen Raum, konkrete Instanzen, veränderte Kacheln, Timer und globale Spielvariablen.

Die öffentliche Bibliotheks-API wird im lokalen Paket `libs/game-engine/` gepflegt; die [Bibliotheksdokumentation](../libs/game-engine/README.md) beschreibt dessen eigenständige Nutzung. Quellcode, Tests und Build-Skript bleiben zunächst in diesem Repository. Die Komponente lädt die versionierten Artefakte aus `libs/game-engine/dist/` über `ccm.load`. Dieses Dokument beschreibt die Spieldefinition und ihre Verwendung in der CCM-Komponente.

Eine Editor-Komponente kann später genau dieses Datenformat erzeugen. Die Runtime benötigt keinen Editor und keinen Build-Schritt. Das [mitgelieferte Beispielspiel](../resources/demo/README.md) zeigt mehrere dieser Möglichkeiten; seine Einbettung liegt in `resources/configs.mjs`.

## Ein kleines Spiel

Diese Definition benötigt keine eigenen JavaScript-Aktionen. Die Figur bewegt sich nach rechts; beim Anklicken kehrt sie um und erhöht den Punktestand.

```js
const game = {
  id: "moving-square",
  schemaVersion: 1,
  version: 1,
  title: "Bewegtes Quadrat",
  width: 640,
  height: 360,
  fps: 60,
  initialRoom: "room1",
  globals: { score: 0 },
  sprites: {
    square: {
      width: 32,
      height: 32,
      frames: [
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="#ffd56b"/></svg>'
      ]
    }
  },
  objects: {
    actor: {
      sprite: "square",
      width: 32,
      height: 32,
      events: {
        create: [{ type: "velocity", vx: 40, vy: 0 }],
        pointerDown: [
          { type: "reverse", axis: "x" },
          { type: "score", value: 1 }
        ]
      }
    }
  },
  rooms: {
    room1: {
      width: 640,
      height: 360,
      background: "#17232d",
      instances: [{ object: "actor", x: 100, y: 180 }]
    }
  },
  hud: [{ label: "Punkte", path: "globals.score" }]
};
```

Der Aufruf mit einer eingebundenen ccmjs-Version lautet:

```js
await ccm.start("./ccm.game.mjs", { game }, document.querySelector("main"));
```

## Grundstruktur einer Spieldefinition

| Feld | Bedeutung |
| --- | --- |
| `id` | Stabile Kennung des Spiels; Bestandteil der Spielstandprüfung. |
| `schemaVersion` | Formatversion, aktuell `1`. |
| `version` | Version dieses konkreten Spiels, standardmäßig `1`. Bei inkompatiblen Änderungen erhöhen. |
| `title`, `description` | Titel und Beschreibung in der Oberfläche. |
| `width`, `height` | Logische Standardgröße in Pixeln. Räume können eigene Größen festlegen. |
| `fps` | Simulationsschritte pro Sekunde. Bewegung und Alarmzeiten verwenden Sekunden. |
| `initialRoom` | Schlüssel des ersten Raumes. |
| `globals` | Anfangswerte globaler Spielvariablen. |
| `sprites` | Sprite-Definitionen nach Schlüssel. |
| `assetBase` | Optionale absolute Basis-URL für relative Sprite-URLs. |
| `view.zoom` | Anfängliche Darstellungsvergrößerung von `1` bis `2`, standardmäßig `1`. |
| `view.frame` | Optionaler dekorativer Rahmen außerhalb des scrollbaren Spielfelds: `{ image: "URL", inset: 34, background: "#252631" }`. `inset` ist der Abstand in CSS-Pixeln (0–80). |
| `objects` | Objektvorlagen nach Schlüssel. |
| `rooms` | Raumdefinitionen nach Schlüssel. |
| `tools` | Optionale Werkzeuge für die untere Bedienleiste. |
| `hud` | Optionale Anzeigen für Werte im Spielstand. |
| `help` | Liste kurzer Spielanweisungen. |
| `labels` | Optionale Oberflächentexte: `eyebrow`, `room`, `next`, `resultTitle`, `footer`. |

Die Definition bleibt während des Spielens unverändert. Jede Runtime erzeugt ihre eigenen Instanzen und eine eigene Kopie der Anfangswerte.

### Ansicht

`view: { zoom: 1.25 }` startet das Spielfeld bei 125 Prozent. Die allgemeinen **− / +**-Schaltflächen ändern die Darstellung in Schritten von 0,25 zwischen 100 und 200 Prozent; der vergrößerte Spielbereich lässt sich scrollen. Die Vergrößerung ändert weder Raumkoordinaten noch Simulation oder Kollisionsflächen.

**Vollbild** zeigt den gesamten Raum so groß wie möglich innerhalb der verfügbaren Fläche, ohne Verzerrung oder Scrollbalken im Spielbereich. Die bisherige Zoomstufe bleibt für die Rückkehr erhalten. Die Komponente verwendet die native Fullscreen API; wenn sie fehlt oder die Einbettung sie ablehnt, füllt eine feste Ansicht das Browserfenster aus. Escape oder **Vollbild beenden** stellt die normale Ansicht wieder her. Größenänderungen und Raumwechsel berechnen die Einpassung erneut, auch bei pausiertem Spiel. Auf schmalen oder niedrigen Displays ersetzt eine kompakte Werkzeugauswahl die Iconleiste.

```js
await app.setFullscreen(true);                    // Native API mit Fenster-Fallback.
await app.setFullscreen(true, { native: false }); // Ausdrücklich nur das Fenster füllen.
await app.setFullscreen(false);                   // Vorherige Ansicht wiederherstellen.
```

`app.gui.fullscreen` zeigt den aktiven Zustand, `app.gui.fullscreenMode` ist `"native"`, `"viewport"` oder `null`. Diese Werte gehören zur Oberfläche, nicht zum gespeicherten Spielstand. Ein nativer Eintritt muss aus einer Benutzeraktion kommen; Browserbeschränkungen führen zum Fenster-Fallback. `stop()` und `destroy()` räumen die Ansicht und ihre Größenbeobachter auf.


### Sprites

```js
sprites: {
  walker: {
    width: 48,
    height: 48,
    fps: 6,
    frames: ["./assets/walk-1.svg", "./assets/walk-2.svg"]
  }
}
```

Frames können Bild-URLs, direkt enthaltene SVG-Zeichenketten oder Ausschnitte aus einem Sprite-Atlas sein. SVG-Inhalte werden als Bilder gezeichnet, nicht als DOM-Fragmente in die Webseite eingesetzt.

Ein Atlas-Frame beschreibt das Quellrechteck in Pixeln. Alle vier Werte sind ganze Zahlen: `sx` und `sy` sind mindestens null, `sw` und `sh` sind größer als null. Das Rechteck muss vollständig im geladenen Bild liegen. Mehrere Frames und Sprites können dieselbe Datei verwenden; der Renderer lädt und dekodiert sie pro Renderer-Instanz nur einmal.

```js
sprites: {
  happy: {
    width: 64,
    height: 64,
    originX: 32,
    originY: 38,
    fps: 5,
    frames: [
      { src: "./assets/actor-atlas.png", sx: 0, sy: 512, sw: 256, sh: 256 },
      { src: "./assets/actor-atlas.png", sx: 256, sy: 512, sw: 256, sh: 256 }
    ]
  }
}
```

Die Zielgröße kommt weiterhin von `sprite.width` und `sprite.height`; die Auflösung des Atlas verändert weder die Größe im Spiel noch die Kollisionsfläche. `originX` und `originY` legen den Zeichenanker in Pixeln der Zielgröße fest, standardmäßig deren Mittelpunkt. Damit lassen sich Füße auch bei verschiedenen Posen auf derselben Bodenlinie halten.

Ein Atlas-Frame kann zusätzlich `offsetX` und `offsetY` enthalten (endliche Zahlen, jeweils standardmäßig `0`). Sie verschieben ausschließlich die Zeichnung um logische Zielpixel, beispielsweise `offsetY: -1.25` zur präzisen Ausrichtung einer Fußsohle. Die Versätze werden nach dem Sprite-Ursprung und vor Spiegelung/Drehung angewandt; Quellbild, Instanzposition und Kollisionsfläche bleiben unverändert. Bei einem direkten `painter.paint()`-Aufruf mit abweichender Zielbreite oder -höhe skalieren Ursprung und Versätze mit der Zeichnung. Objektinstanzen verwenden weiterhin die Sprite-Größe unabhängig von ihrer Kollisionsfläche.

Relative Bild-URLs beziehen sich auf `game.assetBase`, falls angegeben, sonst auf die einbettende Webseite (`document.baseURI`). Für eine Konfigurationsdatei, die auch von fremden Webseiten geladen wird, bietet sich beispielsweise `assetBase: new URL("../", import.meta.url).href` an. Dieser Ausdruck wird beim Laden des Konfigurationsmoduls zu einer normalen URL-Zeichenkette; die fertige Spieldefinition bleibt serialisierbar.

Sprite-Abmessungen bestimmen die Zeichengröße. `width` und `height` einer Objektinstanz bestimmen ihre rechteckige Kollisions- und Trefferfläche. Die Position liegt jeweils **in der Mitte**. `imageIndex` bezeichnet den Animationsstand, `imageSpeed` die Bildwechsel pro Sekunde. `angle` verwendet Grad. Größere `depth`-Werte werden weiter hinten gezeichnet.

### Objekte und Instanzen

```js
objects: {
  guard: {
    sprite: "walker",
    width: 36,
    height: 44,
    depth: 0,
    visible: true,
    solid: false,
    persistent: false,
    properties: { health: 3, walkingSpeed: 60 },
    events: {
      create: [{ type: "velocity", vx: { ref: "self.walkingSpeed" }, vy: 0 }]
    }
  }
}
```

`properties` enthält Anfangswerte je Instanz. Eine Platzierung im Raum kann Werte überschreiben:

```js
instances: [
  { object: "guard", x: 96, y: 64 },
  { object: "guard", x: 160, y: 64, walkingSpeed: 30 }
]
```

Die Runtime vergibt Instanz-IDs. Alle Instanzen einer Objektart teilen sich die Definition ihrer Ereignisse, aber keine veränderlichen Eigenschaften. `persistent: true` erhält eine Instanz beim Raumwechsel; ihr `create`-Ereignis wird dabei nicht erneut ausgeführt.

Standardfelder einer laufenden Instanz sind `id`, `object`, `sprite`, `x`, `y`, `width`, `height`, `depth`, `visible`, `solid`, `persistent`, `vx`, `vy`, `imageIndex`, `imageSpeed`, `angle`, `scaleX`, `scaleY`, `alpha` und `alarms`. Eigene Spielwerte sollten andere, beschreibende Namen verwenden. Interne Identitätsfelder sind keine frei austauschbaren Spielvariablen.

### Räume und Kacheln

```js
rooms: {
  laboratory: {
    width: 256,
    height: 192,
    background: "#101923",
    tileSize: 64,
    tiles: ["####", "#  #", "####"],
    legend: { "#": { type: "wall" }, " ": null },
    tileTypes: { wall: { sprite: "wall_panel", solid: true } },
    instances: [{ object: "guard", x: 96, y: 96 }],
    properties: { lightsEnabled: true }
  }
}
```

Kacheln sind quadratisch und liegen auf einem durchgehenden Raster. Statt Zeichenketten können die Zeilen auch Arrays mit Kachelobjekten oder `null` enthalten. `null` bedeutet eine leere Zelle. Die aufgelösten Kacheln befinden sich im Spielstand unter `state.room.tiles`. Jede Zelle erhält eine eigene Kopie ihrer Daten.

Raumeigenschaften unter `properties` werden ebenfalls in den Zustand des Raumes kopiert. Beim erneuten Betreten eines Raumes wird dessen Zustand aus der Definition neu aufgebaut; dauerhaftes Fortschrittsverhalten muss ausdrücklich als Spielregel modelliert werden.

## Ereignisse

| Ereignis | Zeitpunkt / Bedeutung |
| --- | --- |
| `create` | Einmal beim Erzeugen einer Instanz, nach dem Setzen ihrer Anfangswerte. |
| `destroy` | Beim ausdrücklichen Entfernen einer Instanz. |
| `roomStart`, `roomEnd` | Beim Betreten bzw. Verlassen eines Raumes. |
| `beginStep`, `step`, `endStep` | Die drei Phasen eines Simulationsschritts. Alle Begin-Step-Ereignisse liegen vor allen Step-Ereignissen; alle End-Step-Ereignisse danach. |
| `collision:OBJECT` | Berührung mit einer Instanz des genannten Objekts; `other` ist die andere Instanz. |
| `collision:tile` | Kachelkollision; `input.tile` enthält `col`, `row` und `cell`, zusätzlich gibt es `input.axis` und `input.normal`. |
| `alarm:NAME` | Ein zuvor gesetzter Alarm ist abgelaufen. |
| `pointerDown` | Zeigerklick bzw. Antippen der vordersten sichtbaren Instanz. |
| `pointer` | Weltkoordinaten eines Klicks für Spielregeln; an alle Instanzen verteilt. |
| `keyDown:KEY`, `keyUp:KEY` | Tastendruck bzw. Loslassen, beispielsweise `keyDown:ArrowLeft`. |
| `command:NAME` | Befehl aus Oberfläche oder API. |
| eigener Name | Mit der Aktion `emit` oder der Runtime-API ausgelöst. |

`pointer` liefert `input.x`, `input.y`, `input.button`, `input.target` und `input.tile: { col, row }`. Touch und Maus verwenden dieselben Spielregeln.

Timer folgen der **Simulationszeit**. Eine Pause hält deshalb auch Zeitfenster für Aktionen und Objektbewegungen an. Alarmzeiten in der Engine werden primär in Sekunden angegeben; sie sind keine unverändert übernommenen GameMaker-Alarmwerte.

Ein Schritt durchläuft Begin Step, Alarmprüfung, Step, automatische Bewegung/Kollisionen und End Step. Ein Raumwechsel unterbricht die Verarbeitung des vorherigen Raumes. Ein Raumwechsel aus `roomEnd` kann das Ziel der aktuellen Transition ändern; endlose Wechsel zwischen Räumen werden begrenzt.

## Aktionen und Ausdrücke

Ein Ereignis enthält eine geordnete Liste von Aktionen. Eine Aktion hat mindestens ein `type`-Feld. Aktionsparameter dürfen einfache Werte oder Datenausdrücke sein; ausführbare JavaScript-Zeichenketten werden nicht interpretiert.

### Referenzen und Operatoren

```js
{ ref: "self.health" }
{ ref: "other.damage" }
{ ref: "global.score" }
{ ref: "input.value" }
{ op: "gte", args: [{ ref: "self.health" }, 3] }
{ op: "add", args: [{ ref: "global.score" }, 5] }
```

Referenzwurzeln sind `self`, `other`, `global` / `globals`, `input`, `state` und `dt`. Unterstützte Operatoren sind `add`, `sub`, `mul`, `div`, `mod`, `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`, `min`, `max`, `abs`, `floor` und `clamp`. `clamp` erhält Wert, Minimum und Maximum.

### Eingebaute Aktionen

| `type` | Parameter | Wirkung |
| --- | --- | --- |
| `set` | `path`, `value`, optional `target` | Eigenschaft setzen. |
| `add` | `path`, `value`, optional `target` | Numerischen Wert addieren. |
| `velocity` | `vx`, `vy` | Geschwindigkeit in Pixeln pro Sekunde setzen. |
| `move` | `x`, `y`, optional `relative` | Position verschieben; `relative` ist standardmäßig `true`. |
| `reverse` | optional `axis` (`x`, `y` oder `both`) | Geschwindigkeitsrichtung umkehren; Standardachse `x`. |
| `spawn` | `object`, optional `x`, `y`, `properties` | Neue Instanz erzeugen und deren Create-Ereignis ausführen. Ohne Koordinate wird die entsprechende Position von `self` verwendet. |
| `destroy` | optional `target` | Instanz entfernen. |
| `sprite` | `sprite` | Sprite wechseln. |
| `alarm` | `name`, `seconds` oder `steps` | Alarm setzen; `steps` wird mit der konfigurierten Simulationsrate umgerechnet. |
| `emit` | `event`, optional `payload` | Eigenes Ereignis für die gewählte Instanz auslösen. |
| `room` | `room` | Zu einem Raum wechseln. |
| `if` | `condition`, `then`, optional `else` | Abhängig von einer Bedingung eine Aktionsliste ausführen. |
| `score` | `value` | Zu `globals.score` addieren. |
| `finish` | optional `result` | Spiel abschließen und ein Ergebnis setzen. |
| `notify` | `event`, optional `payload` | Nachricht an den konfigurierten Host-Callback schicken. |

`target` wählt bei passenden Aktionen `self` (Standard), `other` oder `global`. Ein `path` ist relativ zu diesem Ziel: `{ type: "set", target: "global", path: "score", value: 0 }` setzt den globalen Punktestand. Pfade mit `__proto__`, `constructor` oder `prototype` werden abgelehnt.

`move` ändert eine Position direkt; `velocity` verwendet die automatische Bewegung mit Hindernisprüfung. Für einen Alarm bedeutet eine Dauer von `0` oder weniger: den Alarm löschen. Eine Division oder Modulooperation durch null ergibt `0`.

Eine Bedingung sieht beispielsweise so aus:

```js
{
  type: "if",
  condition: { op: "gt", args: [{ ref: "self.health" }, 0] },
  then: [{ type: "velocity", vx: 60, vy: 0 }],
  else: [{ type: "destroy" }]
}
```

## Werkzeuge und Statusanzeigen

```js
tools: [
  { id: "pulse", label: "Impuls", sprite: "tool_pulse", icon: "✦", hint: "Impuls auslösen", key: "2" }
],
hud: [
  { label: "Energie", path: "globals.energy" },
  { label: "Punkte", path: "globals.score" }
],
help: ["Wähle ein Werkzeug und anschließend eine Figur."]
```

Ein Werkzeug sendet `command:tool` mit `{ tool: "pulse" }`. Die Spieldefinition legt selbst fest, was dieses Werkzeug bewirkt. `globals.tool` hält das aktuell gewählte Werkzeug für die Oberfläche fest.

Mit `sprite` kann ein Werkzeug auf eine Sprite-ID der Spieldefinition verweisen. Die Bedienleiste zeichnet dessen erstes, bereits geladenes Bild in eine transparente Canvas-Fläche mit unverzerrtem Seitenverhältnis. Dabei funktionieren normale Bilddateien, SVGs und Atlas-Ausschnitte gleich; eine zusätzliche Bildanfrage ist nicht nötig. Fehlt ein passendes Sprite, wird `icon` als Textsymbol verwendet. Beschriftung, Tastenkürzel und Bedienung bleiben unverändert; das rein dekorative Bild ist für Screenreader ausgeblendet.

## Wiederverwendbare JavaScript-Aktionsmodule

Umfangreiches Verhalten kann als nachvollziehbares ES-Modul ergänzt werden. Die Spieldefinition referenziert nur die Aktionsnamen. In der CCM-Komponente wird das Modul ausdrücklich über die ccm-Konfiguration geladen; ohne CCM kann dieselbe Modulausgabe direkt an `new GameRuntime(game, { plugins })` übergeben werden.

```js
// resources/custom-actions.mjs
export const actions = {
  "example.damage": (runtime, context, action) => {
    context.self.health -= runtime.evaluate(action.amount, context);
    if (context.self.health <= 0) runtime.destroy(context.self);
  }
};
```

```js
// ccm configuration
{
  game,
  plugins: [["ccm.load", "././resources/custom-actions.mjs"]]
}
```

```js
// inside game.objects.guard.events
"collision:enemy": [{ type: "example.damage", amount: 1 }]
```

Ein Aktionshandler erhält `(runtime, context, action)`. `context` enthält `self`, `other`, `event`, `dt` und `input`. Handler arbeiten synchron; asynchrone Speicherzugriffe gehören in die ccm-Komponente bzw. deren Erweiterungen und nicht in jeden Simulationsschritt.

Ein Modul kann zusätzlich `draw(runtime, ctx, phase, painter)` exportieren. Zeichnungsphasen sind `background` vor den Kacheln, `terrain` nach den Kacheln und vor den Instanzen, `world` nach den Instanzen und `overlay` als letzte Ebene. `ctx` ist der Canvas-2D-Kontext in logischen Spielkoordinaten. Zeichenfunktionen sollen den Spielstand nicht verändern. `painter.paintBlend([{ sprite, x, y, options, weight }, …])` mischt mehrere Posen mit normierten Gewichten auf einer transparenten Zwischenfläche und zeichnet das Ergebnis gemeinsam. Damit lassen sich Zwischenbilder und weiche Zustandsübergänge ohne wiederholte Alpha-Überlagerung gestalten.

Optional ersetzt `drawEntity(runtime, ctx, entity, painter)` die Darstellung einzelner sichtbarer Instanzen. Gibt der Hook ausdrücklich `true` zurück, sind diese Instanz und ihre Zeichnung vollständig behandelt; spätere Hooks und die Standardzeichnung werden dann übersprungen. Andere Rückgabewerte lassen die Prüfung weiterer Plugins und anschließend die normale Sprite-Zeichnung zu. Jeder Hook erhält einen durch `save()`/`restore()` isolierten Canvas-Kontext.

### Kontextabhängiger Mauszeiger

Ein Plugin kann zusätzlich einen synchronen, rein lesenden Hook bereitstellen:

```js
export function cursor(runtime, { x, y }) {
  // x und y liegen bereits in logischen Raumkoordinaten.
  const tile = runtime.tile(Math.floor(x / 64), Math.floor(y / 64));
  return tile ? "copy" : "default";
}
```

Der Rückgabewert ist eine gültige CSS-Cursor-Zeichenkette, beispielsweise `"pointer"`, `"copy"` oder `url("data:image/svg+xml,…") 4 4, pointer`. `undefined` lässt den bisherigen Wert bestehen; bei mehreren Plugins gilt der letzte nichtleere String. Ohne passenden Hook gilt `default`. Der Hook wird bei Pointerbewegung und erneut beim Zeichnen nach Spielzustands- oder Werkzeugänderungen ausgewertet. So reagiert ein Cursor auch auf eine unter ihm laufende Figur oder eine eben geänderte Markierung. Bei Pause, Levelende, Touch-Eingaben oder Verlassen des Canvas verwendet die Komponente den normalen Cursor.

Trefferprüfung und Ausführbarkeit gehören zum Spielmodul und sollten dieselbe Prüfung wie der eigentliche Klick verwenden. Die CCM-Komponente kennt weder die konkreten Werkzeuge noch deren Spielregeln. Der Simulationskern benötigt diesen UI-Hook nicht.

Die allgemeine Runtime importiert weder CCM noch spielspezifische Aktions- oder Darstellungsdateien. Solche Module werden ausschließlich vom jeweiligen Host übergeben. Die Canvas-Zeichenhooks gehören zum optionalen `CanvasRenderer`; der reine Simulationskern benötigt keinen Renderer.

## Musik und Soundeffekte

`game.audio` beschreibt Musik und benannte Klänge. URLs müssen relativ zur einbettenden Seite oder absolut auflösbar sein; in Modulen bietet sich `new URL("./assets/audio/datei.wav", import.meta.url).href` an.

```js
audio: {
  musicVolume: 0.45, effectsVolume: 0.70,
  loadTimeoutMs: 60000,
  music: { src: "./musik.wav", loopStart: 0, loopEnd: 60, volume: 0.75 },
  effects: {
    collect: {
      src: ["./klang-1.wav", "./klang-2.wav"],
      volume: 0.65, minInterval: 0.035, maxVoices: 5
    }
  }
}
```

`src` akzeptiert eine URL oder eine Liste. Bei Effekten sind dies wechselnde Varianten; bei Musik wird die erste verfügbare Datei verwendet. Lautstärken liegen zwischen 0 und 1, Schleifenpunkte und Mindestabstände sind Sekunden. `loadTimeoutMs` begrenzt Laden und Dekodieren (Standard 60 Sekunden, erlaubt 5–120 Sekunden). Bis zu 16 Effektstimmen können insgesamt gleichzeitig erklingen. Ungeladene, pausierte oder stummgeschaltete Ereignisse werden verworfen, nicht nachträglich abgespielt.

Ein synchroner Plugin-Handler löst einen Klang mit `runtime.notify("sound", { name: "collect" })` aus. Optional sind `volume` als weiterer Faktor und `pan` von −1 bis 1 möglich. Bestehende synthetische Töne bleiben mit `{ frequency: 440, duration: 0.08, type: "sine", volume: 0.08 }` nutzbar; `type` kann auch `triangle`, `square` oder `sawtooth` sein.

Variantenwahl und Audioposition verändern weder Spielzufall noch Speicherstände. Die Musik läuft im dekodierten Puffer nahtlos zwischen ihren Schleifenpunkten. Pause hält ihre Position; Neustart und Raumwechsel setzen sie zurück. Nach dem Laden eines Spielstands bleibt auch Audio pausiert. Die Erfolgsmelodie darf auf dem Ergebnisbildschirm ausklingen.

## ccm-Konfiguration, Einbettung und Speicherung

Die äußere ccm-Konfiguration enthält `game`, `plugins`, optional `storage`, `extensions`, `autoStart` und `sound`. Engine, Renderer, Audiomodul und CSS sind als ccm-Abhängigkeiten in der Komponente vorkonfiguriert. `engine` exportiert `GameRuntime`, `renderer` exportiert `CanvasRenderer` und `audioModule` exportiert `GameAudio`. Diese Module sind austauschbar; `app.audio` bezeichnet weiterhin die laufende Audioinstanz, nicht das geladene Modul. `autoStart: false` beginnt mit angehaltener Simulation. `sound` ist standardmäßig `false`. Audio startet dennoch erst nach einem Klick oder Tastendruck im Spiel. Musik und Effekte haben eigene Lautstärkeregler. Diese Einstellungen bleiben bei einem Neustart über die Oberfläche erhalten, gehören aber nicht zum gespeicherten Spielstand.

Für Werkzeugbilder ruft die Komponente nach `renderer.load()` die öffentliche Methode `renderer.drawSpritePreview(canvas, spriteId)` auf. Der mitgelieferte Renderer zeichnet das erste geladene Bild proportional und transparent in eine Vorschau mit 40 × 40 logischen Pixeln und zwei Pixeln Innenabstand; die Pixeldichte wird bis Faktor 2 berücksichtigt. Er verwendet vorhandene Bilder, verändert weder Spielfeld noch Simulation und liefert `true` bei erfolgreicher Darstellung, andernfalls `false`. Die Komponente benötigt dadurch keine Kenntnis des Bildcaches oder der Atlas-Struktur. Bei eigenen Renderern ist diese Methode optional; ohne sie bleiben Beschriftungen und Werkzeugfunktionen verfügbar.

```js
{
  game,
  plugins: [],
  storage: {
    store: ["ccm.store", { name: "my-game-saves" }],
    key: "my-game-player-1"
  },
  autoStart: false,
  sound: false,
  extensions: [["ccm.load", "././resources/my-game-extension.mjs#onGameEvent"]]
}
```

Änderungen am Engine-Quellcode werden im Repository-Hauptverzeichnis mit `npm --prefix libs/game-engine run build` in die lokalen `dist/`-Artefakte übernommen. `npm --prefix tests test` prüft Komponente, Beispielspiel und das Engine-Paket zusammen.

Die mitgelieferten Bibliotheksmodule sind auf Version 1.0.0 festgelegt. Eine Konfiguration auf einer Seite im Repository-Hauptverzeichnis kann die Abhängigkeiten ausdrücklich angeben:

```js
{
  engine: ["ccm.load", "./libs/game-engine/dist/game-engine-1.0.0.mjs"],
  renderer: ["ccm.load", "./libs/game-engine/dist/canvas-renderer-1.0.0.mjs"],
  audioModule: ["ccm.load", "./libs/game-engine/dist/audio-1.0.0.mjs"]
}
```

Für eine Einbettung von einer anderen Adresse müssen diese URLs entsprechend aufgelöst werden. Modulbasierte Konfigurationen können dafür direkte `new URL(..., import.meta.url).href`-Ausdrücke verwenden. Die Engine greift selbst auf keinen CCM-Datastore zu; ihr Host verbindet `snapshot()` und `restore()` mit der gewünschten Speicherung.

Ein Datastore mit `name` ohne `url` speichert über die lokale ccm-Datenverwaltung im Browser. Ein entsprechend konfigurierter Remote-Datastore kann dieselbe Schnittstelle übernehmen. Für getrennte Spieler oder Speicherslots muss `storage.key` getrennt gewählt werden; ohne expliziten Schlüssel wird die Spielkennung verwendet. Die Oberfläche speichert auf ausdrücklichen Knopfdruck, nicht bei jedem Animationsbild.

Ein Datensatz enthält `{ key, gameId, savedAt, state }`. `state` ist ein unabhängiger Snapshot. Beim Laden wird er geprüft und das Spiel zunächst pausiert. Das Laden eines Spielstands führt keine Create-Ereignisse erneut aus und vergibt daher keine Startressourcen ein zweites Mal.

Ein bereits abgeschlossener Spielstand zeigt beim Laden sein Ergebnis wieder an, löst aber kein neues `finish`-Ereignis aus. Ergebnis- oder Statistik-Erweiterungen können so einen tatsächlichen Abschluss von der bloßen Wiederanzeige unterscheiden.

Die ccm-Instanz stellt folgende Schnittstellen bereit:

| Schnittstelle | Wirkung |
| --- | --- |
| `start()` | Spiel neu aufbauen; vorherigen Renderloop und Ereignisbindungen beenden. |
| `state` | Live-Referenz auf den aktuellen logischen Spielstand. |
| `getValue()` | Unabhängigen Snapshot des Spielstands zurückgeben. |
| `pause()`, `resume()` | Simulation anhalten bzw. fortsetzen. |
| `step()` | Pausieren und einen Simulationsschritt ausführen. |
| `command(name, payload?)` | Spielbefehl auslösen und die Anzeige aktualisieren. |
| `setFullscreen(enabled?, { native? }?)` | Gesamten Raum unverzerrt einpassen oder die normale Ansicht wiederherstellen; ohne `enabled` umschalten. |
| `save()`, `load()` | Den konfigurierten ccm-Datastore verwenden. |
| `loadState(snapshot)` | Einen bereits geladenen Snapshot übernehmen. |
| `stop()` | Renderloop, Eingabebindungen, Beobachter und Audio stoppen; Audioressourcen freigeben. |
| `destroy()` | Audiofreigabe abwarten und Erweiterungen benachrichtigen. |

Die Fenstergröße beeinflusst die logischen Spielkoordinaten nicht. Tastatureingaben bleiben auf die fokussierte Spieloberfläche beschränkt. Beim Verlassen des Browserfensters oder beim Wechsel in den Hintergrund pausiert die Simulation. Bei der Rückkehr läuft sie ohne Nachholen der Hintergrundzeit weiter; eine ausdrücklich gesetzte Pause bleibt erhalten. Auch vorübergehendes Entfernen aus dem DOM (einschließlich CCM-ShadowRoots) pausiert nur. Zum endgültigen Freigeben einer Instanz ruft die einbettende Anwendung `stop()` oder `destroy()` auf.

ccm-Erweiterungen erhalten `{ app, type }`. Verfügbare Ereignisse sind `init`, `ready`, `before-start`, `start`, `pause`, `resume`, `finish`, `save`, `load` und `destroy`. Sie sind von den synchronen Ereignissen der Spielobjekte getrennt. Eine Erweiterung kann asynchron arbeiten; sie wird nicht für jedes Animationsbild aufgerufen.

## Runtime-API

Die folgende Übersicht gehört zur derzeit eingebundenen Version 1.0.0. Die maßgebliche API-Beschreibung des lokalen Modulpakets steht in der [Bibliotheksdokumentation](../libs/game-engine/README.md).

`GameRuntime` aus der eingebundenen Bibliothek kann ohne CCM und ohne Browseroberfläche getestet werden. Beispiel aus einem Modul im Repository-Hauptverzeichnis:

```js
import { GameRuntime } from "./libs/game-engine/dist/game-engine-1.0.0.mjs";

const runtime = new GameRuntime(game, { plugins, notify });
runtime.start();
runtime.step(1 / game.fps);
```

| Methode / Feld | Bedeutung |
| --- | --- |
| `definition` | Spieldefinition. |
| `state` | Aktueller veränderlicher Spielstand. |
| `room` | Definition des aktuellen Raumes. |
| `start(roomId?)` | Neue Spielsitzung beginnen. |
| `step(dt?)` | Einen Simulationsschritt ausführen. |
| `spawn(object, x, y, properties?)` | Instanz erzeugen. |
| `destroy(entity)` | Instanz entfernen. |
| `find(object)`, `get(id)` | Instanzen suchen. |
| `tile(col, row)`, `tileAt(x, y)` | Kachel lesen; außerhalb des Rasters bzw. bei Leerzellen `null`. |
| `setTile(col, row, cell)` | Kachel ersetzen oder mit `null` entfernen. |
| `dispatch(entity, event, input?)` | Ereignis an eine Instanz schicken. |
| `broadcast(event, input?)` | Ereignis an die aktuellen Instanzen schicken. |
| `command(name, payload?)` | `command:NAME` auslösen. |
| `pointer(x, y, button?)` | Zeigereingabe in logischen Spielkoordinaten. |
| `key(key, down)` | Tasteneingabe schicken. |
| `goToRoom(id)` | Raum wechseln. |
| `finish(result)` | Simulation abschließen. |
| `snapshot()` | Unabhängige Kopie des Spielstands erzeugen. |
| `restore(snapshot)` | Passenden Spielstand prüfen und übernehmen. |
| `random()` | Reproduzierbare Zufallszahl aus dem gespeicherten Generatorzustand. |
| `evaluate(value, context)` | Datenausdruck auswerten. |

Snapshots enthalten die Spielkennung, Formatversion, konkrete Spielversion, Raum, Instanzen, globale Variablen und Simulationszeit. Ein inkompatibler Spielstand wird abgewiesen. `snapshot()` und `restore()` sind die Basis für eine Datastore-Anbindung; sie verändern nicht die veröffentlichte Spieldefinition.

Die Runtime begrenzt Instanzanzahl, Aktionszahl und verschachtelte Ereignisaufrufe, damit beispielsweise ein versehentlich rekursives Ereignis mit einer verständlichen Fehlermeldung endet.

## Bewusste Grenzen dieser ersten Fassung

- Kollisionen verwenden achsenparallele Rechtecke und quadratische Kacheln. Sprite-Rotation verändert die Kollisionsmaske nicht.
- Die Darstellung verwendet Canvas 2D mit SVG-/Bildsprites; HTML übernimmt die Bedienoberfläche.
- Es gibt keine GML-Ausführung, keinen Import von `.gm81`-Dateien und keine Zusage, die komplette GameMaker-8.1-API nachzubilden.
- Ein visueller Raum- und Regel-Editor ist noch nicht Bestandteil der Komponente.
- Erweiterungen wie Pfadeditor, Timeline-Editor, Pixelmasken oder ein allgemeines Physiksystem können später auf dem Spielmodell aufbauen.

Referenzen: [ccmjs-Wiki](https://github.com/ccmjs/framework/wiki), [GameMaker-Ereignismodell](https://manual.gamemaker.io/lts/en/The_Asset_Editors/Object_Properties/Object_Events.htm).
