# Orientation Day

A five-minute, first-person cold open set in an office park.

You wake up on the shuttle from Lot F. It is 7:42 on a Monday. The HR system
migrated over the weekend and nobody is in it. You ride to Building C, get a
badge photo you cannot retake, find a dot to stand on, and are called up to
share a fun fact. Then the pond gets involved.

Who you are is never stated. The other characters drop hints.

## Play

Open `index.html`. It is one self-contained file. No server, no install.

| Action     | Keyboard and mouse           | Touch                 |
| ---------- | ---------------------------- | --------------------- |
| Look       | Move the mouse, or drag      | Drag                  |
| Walk       | W A S D or arrow keys        | Left thumb            |
| Skip ahead | Hold F                       | Hold the corner button |
| Mute       | M                            | Corner button         |

Sound is worth having on. Every sound is synthesised at runtime.

## How it is built

The opening borrows a structure, not content. Four beats, in order:

1. **Constrained start.** You can look but not move, so the game sets the pace.
2. **Exposition by eavesdropping.** People talk to each other and you learn the
   place without a text dump.
3. **Identity at a natural pause.** Someone in the world needs your details,
   which is the character creator.
4. **Disruption hands over the scene.** The routine breaks at the moment of
   highest dread.

Everything else is original: the setting, the cast, the script, the art, and
the audio. There are no external assets. Geometry is built from primitives,
textures are drawn on canvases, and audio is WebAudio oscillators and noise.

## Develop

```sh
npm install
npm run build      # bundles src/ into index.html
npm run playtest   # plays the whole game headlessly and saves screenshots to shots/
```

`npm run playtest` needs Playwright with Chromium available on the machine.

| File              | What it holds                                              |
| ----------------- | ---------------------------------------------------------- |
| `src/story.js`    | The script, shuttle timing, and all staging                |
| `src/world.js`    | The campus: road, Lot F, pond, plaza                       |
| `src/bus.js`      | The shuttle                                                |
| `src/people.js`   | Characters: build, sit, stand, walk, talk, look            |
| `src/goose.js`    | The goose                                                  |
| `src/audio.js`    | Synthesised sound                                          |
| `src/ui.js`       | Subtitles, fades, the badge kiosk, choices, end card       |
| `src/badge.js`    | Badge and photo drawing                                    |
| `src/player.js`   | First-person rig, walking, collision                       |
| `src/director.js` | Game-time scheduler that cutscenes are written against     |
| `src/main.js`     | Boot and main loop                                         |

The shuttle ride is data. Each line has a fixed duration, so the script
produces a timeline, and the shuttle's speed is solved from it. Speed bumps and
the goose crossing are then placed on the road exactly where the timeline says
the shuttle will be. Edit a line and the road rearranges itself.

Debug flags on the URL: `?debug` (overlay), `?auto` (autopilot), `?speed=4`.
