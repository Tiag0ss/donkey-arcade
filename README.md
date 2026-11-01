# Donkey Arcade

Browser arcade hub with **8 mini-games** starring a helmeted donkey.

**This was just a bit of fun** — a throwaway evening project to play with canvas, ES modules, and some game ideas. Not a product, no backend, no ambitions: a local toy.

## What's in here

- **Procedural** art and animation (no external assets)
- Browser-generated **SFX** only (no music)
- **English** UI
- Local leaderboards & medals via `localStorage`
- Metal Runner plus 7 mini-games in one hub

## Run

Serve the folder over HTTP (ES modules need it):

```bash
cd ~/Projects/donkey-arcade
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Games

| Game | Idea | Controls (summary) |
|------|------|--------------------|
| **Metal Runner** | Endless run-and-gun | Jump / duck / shoot / grenade / switch gun |
| **Donkey Derby** | Top-down lane race | Change lane · nitro |
| **Burro Bounce** | Vertical endless jump | Move · jet kick |
| **Kickfield** | Timing kicks | Pick height · kick |
| **Mine Cart Burro** | Rail chooser | Change rail · jump |
| **Stable Stack** | Hay Tetris + balance | Move / rotate / drop |
| **Hee-Haw Heist** | Stealth carrot heist | Move · sneak · hee-haw |
| **Donkey Duel** | Best-of-5 (VS AI or 2P) | Hold & release charge-kick |

Exact keybinds show in the hub when you select a game.

## Global keys

| Key | Action |
|-----|--------|
| **Enter** | Select / confirm / retry |
| **Esc** | Back to arcade (confirms while playing) |
| **M** | Mute SFX (persisted) |
| **P** | Pause |

## Tech

Vanilla **HTML5 Canvas** + **ES modules**. No bundler, no framework.

```
js/
  shared/     # audio, input, storage, donkey draw, UI, game shell
  games/      # one module per game
  hub.js      # arcade menu
  main.js     # bootstrap
```

Scores and meta live in `localStorage` under `donkey-arcade:*`.

## Closing note

Built to laugh and learn. If something's crooked, that's fine — it was only a joke.
