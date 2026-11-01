# Herding Cats

Get every cat into the carrier before the vet closes. Fifteen appointments with three stars each, a new Daily every day,
rare coats for the Cat-alog and hats, carriers and claps to earn. Alone or with friends.

Play: https://onceworlds.com/play/herding-cats

```
npm install
npm test        # the simulation, clap shots and twists, levels, balance, progression and the multiplayer session
npm run build   # the game, into dist/
```

Tuning:

```
node tools/calibrate.mjs [--write]   # par and expert times per appointment from the herder bot's runs
node tools/daily.mjs [days] [seeds]  # the bot on the Daily against its par, with suggested seconds per cat per room
```

How it plays, looks and sounds: [DESIGN.md](DESIGN.md). Models, textures and sounds (all CC0): [CREDITS.md](CREDITS.md).

MIT licensed.
