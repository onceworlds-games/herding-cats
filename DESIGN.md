# Herding Cats

## Pitch and goal

**Pitch:** The vet closes in two minutes. Get every cat into the carrier. Cats don't do what they're told.

**Goal in one line:** every cat in the carrier before the clock hits zero.

**What the screen shows, with no words:** a sunny cutaway room, cats everywhere, an open red carrier with **0/6** stencilled
on its side, and a wall clock running down.

**Description (store):** "Get every cat into the carrier before the vet closes. Good luck."
**Genre:** Party. **Stack:** Vite + three.js (+ GSAP for UI choreography), fonts from @fontsource.

You can't pick a cat up. You are a person in the room, and cats walk away from you. Everything else follows from that.

## The first 60 seconds

A first-time player (no save) who is alone in the server:

| Time | What happens | Hint (2-5 words) |
|---|---|---|
| 0 s | Title: a miniature cutaway café, sunlight through the windows, a bot cat person herding four cats; one hops onto a table and swats a mug off. "Herding Cats" huge over it, one red **Play** button. | none |
| ~3 s | Tap Play (sound unlocks). The camera glides down into a small studio flat: Appointment 1, *Two Lazy Cats*. The carrier's wire door swings open with a clank, two sleepy cats blink. The wall clock reads 2:00. The person walks in through the front door. | none |
| ~5 s | Control is yours. Gold footprints glow on the floor behind the nearest cat, on the far side from the carrier. | "Stand behind it" (over the cat) |
| ~8 s | You step onto the footprints; the cat flattens its ears and trots away from you, toward the carrier. The clock starts on your first step. | "Push it in" (once it moves) |
| ~15 s | It reaches the gold doormat and slips in. The door snaps shut, "mrrp", a red **IN** stamp thumps above the carrier, the counter pops to **1/2**. | none |
| ~28 s | Second cat in. **2/2**, the carrier wobbles... and a third cat crawls out from under the sofa. The counter flips to **2/3** with a "?!" stamp. (The laugh.) | none |
| ~45 s | Third cat in. The carrier rocks with three faces at the wire. "All in!", stars drop onto a ticket: ★★★ under the 0:30 expert time. | none |
| ~50 s | Results: stars, time, best. **Next** is the big button (Enter). | none |
| ~55 s | Appointment 2 (*Up on the Sofa*): a cat sits on the sofa back and ignores you. | "Shake treats" + key cap J / the Treats button |

A returning player (or anyone joining a server with people in it) goes Play → the Waiting Room lobby (below). After the first
appointment, the lobby is home: Ready plays a match with bots, Appointments and Cat Lady are the solo content.

A first match: Ready → the round intro flies over the room, lands on your own carrier ("Your carrier", 2 s, your colour and
symbol), then on you; the wall clock chimes 3-2-1; cats scatter from the middle as the round opens.

## Controls

| | Keyboard | Phone (platform controls) |
|---|---|---|
| Move | WASD / arrows (screen-relative: up is up the screen) | Stick, `stick: 'analog'` (exact angle matters for herding) |
| Treats (lure) | J or Space | Button 1 "Treats" (key `j`) |
| Clap (scatter) | K or Shift | Button 2 "Clap" (key `k`) |
| Pause (solo) | Esc or P | the platform menu pauses |
| Menus | Enter = main button, Esc = back, arrows/Tab between buttons | taps |

No mouse aiming, no hover. The platform's stick and two buttons are the whole phone control set; they're cleared on every
screen that isn't play. Both orientations work.

## The core loop

Every few seconds: pick a cat → walk around to the far side of it → push it along a line into your carrier's door → it goes
in → pick the next one. Two buttons bend the rules:

- **Walking is the push.** Any cat within 3 u of a person walks (then trots) directly away from them. The closer you are, the
  faster it goes. Stop, and it slows and sits, looking back at you. You steer by where you stand.
- **Treats (J):** every cat within 6 u turns and follows you for 2 s, stopping 1 u away and begging, then sits content for 1 s
  before your push applies again. 4 s cooldown. A gold dotted ring expands to 6 u when you shake, so you see the reach.
- **Clap (K):** every cat within 4 u bolts straight away from you (5 u/s for 0.9 s), cancelling any lure. 3 s cooldown. A
  cream shockwave ring shows the 4 u reach.
- **The door:** each carrier has a gold doormat (1.4 u wide, 1 u deep). A cat on it, moving toward the door (within ~70°),
  goes in: pulled in over 0.35 s, door shut for 0.6 s, then open again. A cat arriving while it's shut bumps and turns away,
  so pace your cats. A cat in a carrier stays there.
- **Cats hate carriers.** A calm cat steers gently away from any carrier within 1.5 u. Nothing wanders in by itself; you
  have to put it there.
- **Cornered cats slip past.** A cat pinned by walls with nowhere to flee crouches for 0.35 s (telegraphed) then dashes past
  you along the wall. Corners are where beginners lose cats.

**What a beginner does:** walks straight at cats, chases them around the room, claps when stuck, gets a cat in now and then.
**What an expert does differently:**
- Approaches on a wide arc so the cat never sees them from the wrong side, then pushes on a straight line to the door.
- Pushes from 2.5 u (slow, precise) instead of 1 u (fast, wild); speeds up only on the final run.
- Lines up two or three cats and walks them in as a train, timing for the door's 0.6 s shut.
- Uses walls as rails: carriers sit near walls, and a cat fleeing along a wall is easy to steer.
- Treat-then-flank: shakes treats beside the door so a group gathers in front of it, steps around behind them, walks them in.
- Saves the clap for Loafs and Zoomers, never claps near a Scaredy.
- Gets the Boss in first so its gang walks in alone; carries kittens in behind their cat.
- In Versus: steals herds lined up at a rival's door, blocks the lane to their carrier with their own push, and claps a
  rival's treat parade apart.

## The cats

Each type reads from its silhouette and walk, and has a small floating symbol (white with a dark outline) shown when it
matters: when it acts, when you're within 7 u, or always for the Boss. Moggies have none.

| Cat | Look | Behaviour | Symbol |
|---|---|---|---|
| **Moggy** (house cat) | ordinary build, any coat | the baseline: wanders, flees your push, follows treats, bolts at claps, hops onto low furniture now and then | none |
| **Loaf** | a round loaf, legs tucked, eyes shut, breathing | sleeps. Ignores walking and treats. A clap within 4 u scoots it 2.5 u straight away from you, then it flops asleep again: golf | floating z's |
| **Zoomer** | slim, long legs and tail, huge eyes | every 5-9 s wiggles its rear for 0.7 s then sprints 7 u/s for 1.2 s, bouncing off walls. Sprints away from the nearest person within 4 u (±10°), else at random. A clap during the wiggle launches it at once, away from you | a bolt, flashing during the wiggle |
| **Scaredy** | small, permanently puffed tail, wide eyes | flees from 5 u away (so it can be steered from far). A clap within 8 u, or a crash within 6 u, sends it under the nearest bed, sofa or table: only its shivering tail shows, and pushes do nothing. Treats within 6 u coax it out | "!" while hiding |
| **Glutton** | wide and heavy, belly sways | slow (1 u/s), barely flees (2.5 u radius, 2.2 u/s max). Hears treats from 14 u (the whole room) and comes at 2.8 u/s for 3 s | a fish when treats rattle |
| **Kitten** | tiny, big head | follows the nearest grown cat within 6 u, 1 u behind it. Flees weakly (2 u). If the cat it follows goes into a carrier and it's within 4 u, it tumbles in after it 0.8 s later | none (size says it) |
| **Boss** | big tom, notched ear, scar, studded collar | never runs (2 u/s max), turns its back on treats. A clap only makes it stalk off (2.5 u/s for 1 s). Its gang (2-3 cats with the same studded collar) follows it within 6 u in a loose V. When the Boss goes in, every gang cat walks to that carrier from anywhere (still fleeing people within 3 u, so a rival can cut them off) and goes in | a crown, always |

**Furniture:** low pieces (sofa, bed, tables, boxes) are perches. An idle cat may hop up (4% a second, 6-15 s); a perched cat
ignores pushes and swishes its tail. Treats or a clap bring it down. Perched cats sometimes swat an object off (a vase, a
mug, a stack of books): it falls and smashes with a crash. Nearby cats flinch; a Scaredy within 6 u hides. Debris has no
collision. Tall pieces (shelves, wardrobes, fridges) are walls. Ponds and railings block people and cats alike.

## Solo

### Appointments: 15 levels

Each level is a room, a fixed set of cats, a closing time and two target times. **★** done before closing, **★★** under
par, **★★★** under the expert time. Missing closing time is "Missed appointment" and a one-tap Retry. The clock starts on the
first move. The wall clock shows the par and expert times as gold notches on its rim; a star drops off as the hand passes
each. Each level introduces one cat or one room feature, and the next unlocks when this one is done (any stars).

| # | Name | Room (u) | Cats | Closes | Par / Expert | New |
|---|---|---|---|---|---|---|
| 1 | Two Lazy Cats | Studio 14×12 | 2 slow moggies (+1 surprise) | 2:00 | 0:50 / 0:30 | the push |
| 2 | Up on the Sofa | Living room 16×14 | 3 moggies, one perched | 2:00 | 0:55 / 0:35 | treats, perches |
| 3 | Loaf Around | Bedroom 16×14 | 2 Loafs, 1 moggy | 2:00 | 1:00 / 0:40 | clap, Loaf |
| 4 | Snack Attack | Kitchen 16×12 | Glutton, 2 moggies | 2:00 | 0:55 / 0:35 | Glutton |
| 5 | Zoomies | Hallway 24×8 | Zoomer, 2 moggies | 2:00 | 1:00 / 0:40 | Zoomer |
| 6 | Under the Bed | Bedroom 18×14 | Scaredy, 3 moggies | 2:00 | 1:10 / 0:45 | Scaredy, hiding |
| 7 | Kitten Pile | Laundry 14×14 | 1 moggy, 3 kittens | 2:00 | 0:55 / 0:35 | Kittens |
| 8 | The Boss | Garden 22×18 | Boss, 3 gang, 1 moggy | 2:30 | 1:20 / 0:50 | Boss, pond |
| 9 | Cat Café | Café 22×18 | 8 mixed | 2:30 | 1:45 / 1:10 | many perches, cat trees |
| 10 | Quiet Please | Library 22×18 | 2 Scaredy, Loaf, Zoomer, 3 moggies | 2:30 | 1:45 / 1:10 | falling books |
| 11 | Moving Day | Flat full of boxes 20×16 | 8 mixed | 2:30 | 1:50 / 1:15 | open boxes: any cat climbs in and sits |
| 12 | All Aboard | Boat deck 24×10 | 8, two Zoomers | 2:30 | 1:50 / 1:15 | narrow lanes, rails |
| 13 | Greenhouse | Greenhouse 20×16 | Boss, 3 gang, Glutton, 2 kittens, 1 moggy | 2:30 | 1:50 / 1:15 | aisles, pots |
| 14 | Rooftop | Roof garden 22×18 | 10 mixed | 3:00 | 2:15 / 1:30 | chimneys, washing lines |
| 15 | Closing Time | Three-room flat 26×20 | 12, every type | 3:00 | 2:30 / 1:45 | doorways between rooms |

Par and expert times above are starting values; the balance simulations set the final ones (see Balance).

A new cat type gets a 2-second introduction when its level starts: the camera frames it, its name and a 2-5 word tip on a
tag ("Zoomer: wait for the wiggle", "Scaredy: don't clap!", "Glutton: loves treats", "Loaf: clap to move",
"Kitten: follows a cat", "Boss: the gang follows"). Then it's gone.

### Cat Lady (endless)

Unlocks after Appointment 5. The Cat Lady's parlour, one carrier, a cat flap. Cats keep coming in through the flap so there
are always 6 loose (rising by 1 every 8 boxed, to 10). The shift clock starts at 1:00 and every cat boxed adds time
(+5 s, shrinking 0.1 s per cat to +2.5 s), flying from the carrier into the clock. The mix escalates: moggies, then a Zoomer
from cat 5, a Scaredy from 10, Gluttons and kittens from 15, a Boss gang from 20. The shift ends when the clock does. Score =
cats boxed. A beginner boxes 10-15 (about 1:30); an expert 40+ (5 minutes or more). Leaderboard `cat-lady`.

**How long solo lasts:** first clear of all 15 about an hour, three-starring everything 3+ hours, Cat Lady and Versus with
bots for as long as the player likes.

## Multiplayer

**Public game**, up to 6 per server: `ow.rooms.join({ maxPlayers: 6, minPlayers: 1, lobby: 'bar', countdown: 0, settings })`.
Joined once on load, before the scene is built. A lone player readies and plays with bots. The title has one button; the
platform's menu has private servers and invites.

**Lobby and ready-up.** The game draws the Waiting Room (who's here, the host's settings, the solo tickets); the platform adds
its Ready/Start strip. Public servers start when everyone connected is ready (the room's own rule, with its 45 s wait for
stragglers); private servers wait for the host's Start (`room.canStart`). Joining never starts anything.

**Settings (host, `room.setSetting`, players ready again after a change):**
- `game`: **Versus** (default) or **Together**.
- `rounds`: 1, **3**, 5. Each round is a different room (seeded, no repeats in a match).

**Versus.** Every seat has its own carrier (a colour and a symbol) around a bigger room. 2:00 rounds; cats = 4 per seat
(16 for 4 seats, 24 for 6). A round ends when the last cat is in or the clock runs out. Your points are the cats in your
carrier; the match is won on total cats. People's pushes affect every cat, so stealing a herd someone lined up is the game.
Each carrier's doormat is its owner's: other people standing on it slide off (no door camping). Persons pass through each
other. Round 1 has moggies, a Glutton and kittens; round 2 adds Zoomers, a Loaf and a Scaredy; round 3+ adds a Boss gang.
Carrier spots rotate each round.

**Together.** One carrier, all the cats, beat the clock. 2:30 rounds; cats = 6 + 3 per seat. Team stars per round:
★ all in, ★★ with 0:45 left, ★★★ with 1:15 left. Results show the team's stars and who boxed most (the last person to push
each cat gets the credit).

**Rounds and timing.** `createMatch` with `rounds: 'rounds'`, `introSeconds: 3` (our own intro: room fly-over, your carrier,
the wall clock chimes 3-2-1; the platform's countdown is 0 so there's one countdown), `roundSeconds` 120 (Versus) / 150
(Together), `roundEndSeconds: 5`, `resultsSeconds: 0` (results stay until the host's page ends the match: after 25 s in a
public server or when the host taps Lobby in a private one). A 3-round Versus match is about 8 minutes.

**Bots** fill empty seats: `createBots(match, { host, fill, think: () => null, names, skill })` seats them (fill 4 in Versus,
3 in Together, via `setFill` when the setting changes), and the host's simulation drives their bodies with the same bot
brain that plays the attract mode. They have names (Marge, Dev, Priya, Otis, Bea, Hiro, Ruth, Sunny, Arlo, Nell, Gus,
Tamsin), their own outfits and hats, and a personality: **Shepherd** (careful arcs, rarely claps), **Clapper** (claps
whenever cats are lined up, sloppier), **Poacher** (Versus: hunts herds near rivals' doors). Skill 0-1 sets re-plan time
(0.6 s → 0.15 s), aim error (±30° → ±5°) and mistakes (picking a far cat, walking through a cat's wrong side). Bots walk at
the same 4 u/s and obey the same cooldowns. Each page puts a herding rank (0-3, from its stars and wins) in presence and the
host scales bot skill to the table's average, so a new player can win.

**Latecomers** watch (the platform's "Watching" note; our camera follows the leader) and join at the next round in a bot's
seat (`admit: 'round'`). **Leavers** keep their seat and points; their person poofs away; in Versus their carrier door shuts
with a "Closed" sign. **Away** players' persons stand dimmed; their carrier stays open. **Host change:** the new host rebuilds
the cat simulation from the last snapshot (`resume`). A reloaded page restores its person from `room.me.presence`.

**Solo while waiting.** Appointments and Cat Lady run from the lobby (`room.hideLobby()` while they run). A solo run ends when
a match starts with this player in it. A player busy in an appointment who isn't ready is left out by the room's 45 s rule,
keeps playing, and joins the next match; the others see "At the vet" on their seat.

**Netcode.**
- **Presence** (every page, 20 Hz): `{ x, z, h, v, tr, cl, s, rk, sk }`: position, heading, speed, a treats counter and a
  clap counter (each press adds 1), screen (`lobby` | `solo` | `play` | `watch`), herding rank, carrier skin. Others are
  drawn with `presenceAt` (100 ms behind); counters are read raw, and a new value plays that person's shake or clap.
- **Host** (`room.isHost && room.connected`, checked every frame): runs the cat simulation at 30 Hz with every person:
  its own exactly, others from presence (validated: finite, inside the room, movement capped at 4 u/s × 1.5; a jump is
  ignored for pushing), bots from its own brain. A counter that went up applies a shake or clap at that person's position,
  if their cooldown allows (the host keeps cooldowns per seat). The host alone decides who goes in which carrier.
- **Round data** (`match.data`, written once per round): room id, seed, carriers (owner seat, position, facing), the cat
  roster (id, type, coat, gang).
- **Cat stream** (`host:cats`, 10 Hz, ~0.7 KB): `{ r: roundId, t: matchMs, c: [[x, z, h, state, aux] ×cats],
  b: [[x, z, h, tr, cl] ×bots], n: { seatId: count }, e: [[seq, kind, a, b] ×last 8] }`, quantized to centi-units. Events
  (in, bump, crash, hide, slip) carry sequence numbers so a page that missed a write still plays them.
- **Every page predicts cats** so your own push answers at once: it runs the same simulation with its own person exact. Each
  snapshot (stamped with match time, which every page shares) resets the cats to the host's state, re-simulated forward to
  now with this page's recorded movement; the drawn cat eases to the corrected spot over 120 ms. Boxing, hiding, perching and
  scores happen only when the host says; a cat on a doormat hesitates (the 0.35 s pull-in), which covers the wait.
- **Scores** are the host's counts; `score(m)` returns them; the host writes results and ends the match.
- No custom messages. Budget: host ~10 state writes/s + presence; others presence only.

## Progression and reasons to come back

- **Stars** (45 in Appointments) and **best times** per level, shown on the Appointment Book and the results.
- **Carrier skins** (cosmetic, shown in Versus too): Classic (red plastic), Wicker Basket (10★), Cardboard Box (25★), Bubble
  Backpack (40★), Golden Carrier (500 cats boxed in all). Tap your carrier on your seat in the lobby to change it.
- **Personal bests:** total stars and Cat Lady best on the title; per level and Cat Lady on their results.
- **Leaderboards:** `cat-lady` (cats in a shift), `stars` (total), `cats-boxed` (lifetime), `appt-01`…`appt-15` (best time,
  lower is better). 18 boards.
- **Badges (10):**

| id | Name | Earned |
|---|---|---|
| `first-cat` | First Cat | Box your first cat. |
| `full-carrier` | Full Carrier | Finish an appointment. |
| `under-par` | Under Par | Beat an appointment's par time. |
| `boss-move` | Boss Move | Box the Boss first, then its whole gang. |
| `zoomies` | Zoomies | Box a Zoomer mid-sprint. |
| `cat-cafe` | Cat Café | Three stars at the Cat Café. |
| `fifteen-appointments` | Fifteen Appointments | Finish all fifteen appointments. |
| `crazy-cat-person` | Crazy Cat Person | Box 500 cats. |
| `best-in-show` | Best in Show | Win a Versus match. |
| `cat-lady` | Cat Lady | Box 25 cats in one shift. |

Save (`ow.save`, key `hc`): `{ v: 1, levels: { n: { stars, best } }, catLady, boxed, wins, skin, hints: {...}, seen }`, written
on events (a level ends, a shift ends, a match ends), never per frame.

## Balance and timing

| | Value |
|---|---|
| Person | 4.0 u/s, full speed in 0.12 s, stops in 0.08 s, radius 0.35 u |
| Flee (moggy) | radius 3 u; speed 1.6 u/s at the edge rising to 3.5 u/s at 1 u; reacts after 0.12 s; keeps going 0.5 s after you leave, then slows over 0.4 s; ±12° wobble changing every 0.5 s |
| Calm | walks 1.5 u/s in 1-3 s bursts, sits 2-6 s |
| Treats | radius 6 u, lure 2 s at 2.2 u/s, stop at 1 u, content 1 s, cooldown 4 s |
| Clap | radius 4 u, bolt 5 u/s for 0.9 s then trot 2.5 u/s for 0.8 s, cooldown 3 s |
| Door | mat 1.4 × 1.0 u, entry within 70° of the door and above 0.5 u/s, pull-in 0.35 s, shut 0.6 s |
| Cornered slip | blocked 0.4 s → crouch 0.35 s → 4.5 u/s for 0.8 s along the wall |
| Zoomer | walk 2 u/s, flee up to 4 u/s, wiggle 0.7 s, sprint 7 u/s × 1.2 s, every 5-9 s, 10% speed lost per bounce |
| Scaredy | flee radius 5 u, 1.8-4.5 u/s, hides on a clap within 8 u or crash within 6 u, creeps out at 1.2 u/s |
| Glutton | walk 1 u/s, flee radius 2.5 u, max 2.2 u/s, treats from 14 u at 2.8 u/s for 3 s |
| Kitten | follows at 1 u, up to 3 u/s, flee radius 2 u, follows in within 4 u after 0.8 s |
| Boss | flee radius 3 u, max 2 u/s, clap → 2.5 u/s for 1 s, gang within 6 u, gang walks to the carrier at 1.8 u/s |
| Loaf | clap scoot 2.5 u over 0.6 s |
| Perch | 4%/s when idle near a low piece, 6-15 s; swat chance 15% per perch |
| Simulation | fixed 30 Hz step with an accumulator; seeded RNG per round; cat-cat separation 0.6 u |
| Versus | 2:00 rounds, 4 cats per seat, 3 rounds, room 24×20 (≤4 seats) or 30×24 (5-6) |
| Together | 2:30 rounds, 6 + 3 cats per seat |
| Bots | skill 0.35-0.7 in public, scaled by the table's rank |

**How they're checked (node tests on the pure modules):**
- Every level solved by the bot brain over 50 seeds: skill 1.0 averages under the expert time × 1.1; skill 0.6 under par;
  skill 0.3 before closing in ≥ 90% of runs. Par and expert are then set from these runs (par ≈ skill-0.6 median, expert ≈
  skill-1.0 25th percentile, rounded to 5 s).
- Versus with 4 and 6 equal bots over 100 seeds: ≥ 70% of rounds end with every cat in before 2:00; the winner's share of
  cats stays under 45% on average (no runaway); a 0.7 bot beats three 0.4 bots in most matches but not all.
- Together with 1-6 seats: three stars reachable by skill-0.8 bots, one star by skill-0.4.
- Cat Lady: a skill-0.5 run lasts 1:30-3:00; a skill-1.0 run passes 40 cats.
- Over 1000 seeds of every room: no cat or person ever inside furniture or outside the walls, no NaN, no cat stuck in one spot
  for 20 s, every hiding spot reachable by treats.

## Every screen

All screens keep clear of `ow.ui.reserved` (top-left 150×70 until it's known). Words in Fraunces, numbers in Big Shoulders
Stencil. Buttons are solid blocks of a palette colour with a 3 px espresso outline and a 4 px hard offset shadow (no blur, no
gloss), ≥ 56 px tall on phones, key caps shown on desktop.

1. **Title.** The Grand Café diorama in attract mode (a bot herding, cats perching and swatting, the camera drifting slowly
   round). "Herding Cats" in Fraunces Black, cream with a thick espresso outline, upper third; the C of Cats has two ear
   notches. A red Play button in the middle-lower third (tap, click, Space or Enter). Under it, one line in stencil: ★ 23/45
   and Cat Lady's best with a carrier glyph (hidden when zero).
2. **Waiting Room (lobby).** A vet's waiting-room diorama: a bench with six seats along the back wall, a reception desk, a
   couple of ambient cats wandering and one asleep in a carrier. Each player sits on a seat with their carrier (colour and
   symbol) on their lap, their name above (white with outline), a brass bell for the host, a ring for You, a green check disc
   when ready (they stand and lift their carrier). Empty seats show an empty chair with a "+" (tap → `ow.ui.showInvite()`).
   A seat busy in solo shows "At the vet". Beside the scene (right column on desktop and landscape, below it on portrait):
   the **settings board** (two segmented rows: Versus | Together, Rounds 1 | 3 | 5; the host taps, others see them lit),
   then two big tickets: **Appointments ★23/45** and **Cat Lady · best 41** (padlocked with "Appointment 5" until earned).
   First-time players see "Start here" on Appointments. The platform's Ready strip sits at the bottom.
3. **Appointment Book.** 15 cards in a 5×3 grid (3 columns × 5 rows on portrait), each: number in stencil, room name, the
   new cat's symbol, earned stars, best time; locked ones show a padlock. Back (top-right). The next unplayed card pulses.
4. **Level intro (2-3 s).** The camera drops onto the room, cats pop in one by one with a meow, a new type gets its tag, the
   person walks in, the carrier door swings open.
5. **Play HUD (solo).** Top centre: the wall clock (a cream face, espresso rim, red second hand, gold star notches) with the
   time in big stencil numerals beside it; red and ticking under 0:30, pulsing under 0:10. Top right: a carrier glyph with
   **3/6**. Under your person, a floor ring in your colour: its left half (gold) is Treats, its right half (cream) is Clap,
   each drained on use and refilling; a press during cooldown flashes it with a dull click. Off-screen: an edge arrow to your
   carrier, and paw arrows to the last cats when 3 or fewer are loose. Hints float above the thing they're about. On desktop,
   bottom right: the two key caps (J Treats, K Clap) with the same cooldown sweep.
6. **Level results.** The camera pushes into the carrier (faces at the wire) and a ticket slides up: "All in!" (or "Missed
   appointment" with the cats left), the stars dropping in one by one with a thunk each, time, par/expert, best (a
   "New best" stamp), the level's top 5 times. Buttons: **Next** (Enter, primary; Retry when missed), Retry (R), Book (Esc).
7. **Pause (solo).** The scene freezes and darkens a little; a card: Resume (primary), Retry, Book.
8. **Cat Lady.** HUD: the clock (each boxed cat sends a "+5" into it), boxed count big at top right. End: "Shift over", the
   count, best, top 5, Retry (primary), Lobby.
9. **Round intro (3 s, multiplayer).** "Round 2 · Reading Room" painted large on a wall of the room as the camera flies over;
   your carrier lights up with "Your carrier"; the wall clock chimes 3-2-1 and the round opens.
10. **Play HUD (multiplayer).** The clock as in solo. Versus: top right, your carrier glyph and count (big); under it a column
    (a row under the clock on portrait) of every seat's carrier glyph with its symbol and count, the leader's wearing a gold
    rosette. Names over heads. Together: one counter on the shared carrier, the clock rim shows the team star notches.
11. **Round end (5 s).** The camera swoops over the carriers; each count pops in stencil; the round winner's carrier gets the
    rosette and a stamp: "Priya wins · 7 cats" (Together: "★★ with 0:52 left").
12. **Match results.** Podium: the top three stand on stacked carriers (stack height = their cats), holding their carriers,
    cats' faces at the wire; confetti of treats and fur; a fanfare. Standings beside it: place, headshot (`avatarUrl` head),
    name, total cats. "Best in Show" stamp on the winner. Host: Lobby button (private) or a 25 s ring (public).
13. **Watching.** The match, camera on the leader; our own "Next round" note once admitted.
14. **Room closed.** One message, one button: "You were removed" + Play; "Connection lost" + Rejoin; "Playing in another tab"
    + Play here. Each re-joins with the same options.

## Art direction

**The world:** miniature cutaway apartments, as if a set designer built tiny lived-in rooms on a tabletop. Each room is a slab
with a visible cross-section (oak boards, a plaster layer, a dark base), two back walls with sunlit windows, the front walls
cut away, floating over a warm dark backdrop. Warm wood, rugs, plants, books, sun shafts with drifting dust motes. Soft,
chunky, rounded low-poly forms with smooth shading, like painted resin miniatures.

**Palette:**

| | Hex | Use |
|---|---|---|
| Oak | `#D9A066` | floors, furniture |
| Sage | `#A3BE9B` | walls (rooms tint it toward blush or butter) |
| Cream | `#FFF3DF` | light surfaces, text fill |
| Espresso | `#2B1D1C` | ink: outlines, text stroke, backdrop base |
| Carrier red | `#E5493A` | the carrier, Play, urgency |
| Treat gold | `#F6B941` | treats, stars, doormats, highlights |
| Fern | `#4F9A5E` | ready, success, plants |

Seat colours with symbols (Versus, colour-blind safe by symbol): red + fish, blue `#3F7FCB` + yarn ball, gold + bell, fern +
paw, violet `#8C5BC4` + mouse, pink `#E57FA6` + moon.

**Fonts:** Fraunces (900 for display, 700 for labels; soft and characterful, not a kid font) and Big Shoulders Stencil Display
(800) for every number: the counts, the clock, the scores, as if stencilled on carriers. Both self-hosted from @fontsource,
latin subset, OFL.

**Signature element: the carrier.** A chunky red plastic carrier with a wire door and the count stencilled on its side in big
numerals; its door snaps shut with a red **IN** stamp for every cat. It's in the logo's lockup on the icon, it's the HUD
counter's glyph, it's each player's lobby seat, the podium is stacked carriers, and the cover's subject.

**Lighting and camera:** late-afternoon sun from the back windows (warm `#FFE2B0`, soft shadows from a shadow camera fitted to
the room; map 1024 medium, 2048 high, none low), a hemisphere fill (cool sky, warm floor bounce), ACES tone mapping, sRGB,
light fog fading the slab's base into the backdrop. Orthographic camera, yaw 45°, pitch 40° (steeper than true isometric so
the floor reads). It frames the whole room when that keeps 1 u ≥ 34 CSS px; otherwise it follows you with 0.6 s look-ahead,
clamped to the room. Tall furniture between the camera and a cat or person dithers out. High quality adds a tilt-shift blur
(top and bottom of the screen) for the miniature look; low drops shadows, outlines and dust.

**Cats** are the stars: procedural rounded bodies with a small rig (spine, head, ears, four legs, a 4-joint spring tail),
coats in vertex colour (ginger tabby, grey tabby, tuxedo, calico, black, white, tortoiseshell, siamese points), a thin
espresso outline. Ears flatten when pushed, perk at treats; tails puff when scared, go straight up when content, swish on a
perch; heads track the nearest person; blinks; squash on landings, stretch on leaps.

**People:** chunky rounded figures dressed from the player's avatar (`ow.player.avatar`: skin, shirt, pants, hat), a gold
treat bag in one hand. Shake: bag up and rattled with gold sparkles. Clap: hands over the head, a cream shockwave ring. Bots
dress in their own outfits (cardigans, overalls, scrubs, sun hats).

**HUD in the world's language:** the timer is the room's wall clock; the score is stencilled on carriers; results are stamps;
hints are short words floating over the thing they're about. No boxes behind HUD items: white or cream text with a thick
espresso outline, or a solid band where needed.

## Sound

All synthesized in Web Audio, through a light room reverb (a generated impulse).

| Action | Sound |
|---|---|
| Footsteps | soft filtered taps, pitch by floor (wood, rug, grass, deck) |
| Cat pushed | a short "mrt" or a grumble, pitch per cat (kitten high, Boss low), varied length and contour |
| Meows | formant-filtered saw with a rising-falling contour and vibrato, randomised per cat |
| Treats | the bag's rattle: 8-12 granular clicks; purrs from lured cats (low amplitude-modulated noise) |
| Clap | a sharp noise transient into the reverb, then hisses (band-passed noise sweeps) from cats in range |
| In | carrier door clank (inharmonic partials + latch click), a "mrrp" trill, the stamp's thump |
| Bump at shut door | a hollow plastic knock + an offended "mrow" |
| Crash | glass/ceramic shatter: noise bursts + random high pings |
| Zoomer | claw scrabble then a whoosh |
| Scaredy hides | a squeak and a scurry |
| Slip past | a quick skitter and a cheeky chirp |
| Clock | ticks from 0:30, louder from 0:10; the vet's door chime at closing |
| UI | a soft wooden tap for buttons, a star "tink" rising per star |
| Stingers | round start (vibraphone run + chime), all in (a bright horn chord + a little chorus of meows), missed (a sliding trombone "wah-wah"), match win fanfare |

**Music:** a small step sequencer playing light jazz at 112 BPM with swung eighths: pizzicato walking bass, brushed snare
swishes on 2 and 4, a vibraphone-like melody (sine + soft FM) over Gm7-C7-Fmaj7-D7, phrases picked by seed so rounds differ.
In the last 30 s the tempo eases to 132 and a staccato counter-line joins. Menus play just bass and brushes, 8 dB quieter.

## Store art and trailer

Posters (deterministic, `?poster=<name>`, real renderer, no HUD):
- **cover** (1280×720): the café; a person mid-clap with the shockwave ring, five cats bolting toward the red carrier (one
  mid-air at the door), a cat on the bookshelf knocking a vase off (frozen mid-fall). "Herding Cats" once, big, top left.
- **action** (1280×720): a low close-up of a Zoomer mid-leap over a rug, ears back, the carrier door open behind it.
- **win** (1280×720): a full carrier close-up, six cats' faces squashed against the wire, the IN stamp, treat confetti.
- **multi** (1280×720, thumb-4): Versus from above, four people with coloured carriers, a herd being stolen, the Boss
  marching in with its gang.
- **icon** (512×512): the carrier's wire door, a ginger cat face peeking through, on a sage disc. No text.
- **badge-<id>** (256×256): a bold symbol on a palette disc (a paw, a full carrier, a stopwatch, a crown, a bolt, a café cup,
  "15", a heart of cats, a rosette, a teacup).

**Trailer (~30 s, 1280×720, autoplay capture):**
1. 0-3 s: a push. A ginger cat trots straight into the carrier: clank, IN, 1/6. (The goal, at once.)
2. 3-8 s: a lure. Treats rattle, three cats turn and follow, the flank, a train of three goes in: IN, IN, IN.
3. 8-14 s: chaos. A clap, cats bolting, a cat on a shelf swats a vase, a Zoomer sprints right into the carrier.
4. 14-22 s: Versus. Four players, a herd stolen at a rival's door, the Boss goes in and its gang marches after it.
5. 22-28 s: the last cat in at 0:01, the clock red, the stamp, "All in!", fanfare.
6. 28-31 s: "Herding Cats" over the café attract mode.

## Originality check

It resembles sheepdog herding games (push animals into a pen by walking at them) and the chaos of co-op kitchen games. What a
player notices in the first minute that is different: the animals are individuals, not a flock (the Loaf won't budge, the
Zoomer launches itself, the Scaredy hides, the Glutton crosses the room for a rattle, the Boss brings its gang); you have
exactly two extra verbs, a lure and a scatter, each with a reach you can see; the carrier door is a rhythm (in, shut, open),
so trains of cats have to be timed; and in Versus every herd anyone lines up can be stolen. The look, a sunlit miniature
diorama with stencilled carriers and an IN stamp, is its own.

## Risks

- **Herding feels slippery or frustrating.** All constants in one tuned file; the door mat and the 70° entry make "close
  enough" count; corners telegraph the slip; level 1 shows footprints; levels are checked solvable by the bot brain.
- **Remote players' pushes lag.** Local prediction with host snapshots (above). If corrections show as jitter, raise the
  smoothing to 200 ms and add a 0.12 s reaction delay to every cat so the delay reads as the cat's own. Tested in node with a
  fake room and 150 ms of simulated latency.
- **Too much to learn.** One cat type per level with a tag; Versus adds types round by round; symbols only when relevant.
- **Small cats on a phone.** The camera keeps 1 u ≥ 34 px and follows; edge arrows for the carrier and the last cats.
- **Performance with 24 cats and 6 people.** One skinned mesh per cat (shared material), rooms merged by material, instanced
  particles and debris: under ~150 draw calls; tilt-shift and outlines only above low.
- **Scope (15 levels, endless, two team modes).** Rooms are data on a 1 u grid built from a kit of ~20 furniture pieces; build
  order: the push and one level → all cat types → Appointments → Versus → Together → Cat Lady → polish, posters, trailer.
- **Door camping and griefing in public.** Doormats belong to their owner; persons don't collide; clap and treats affect
  only cats.
- **A host whose tab is backgrounded.** The platform hands the role over; the new host resumes from `host:cats`.

## Where this changes the spec

- **Rounds are 2:00 in Versus** (spec: 3:00), to match the pitch's "two minutes" and keep a 3-round match near 8 minutes;
  Together is 2:30. Versus uses 4 cats per seat (16 with 4 seats, 24 with 6).
- **A plain house cat (Moggy)** is the baseline the six personalities stand out from; level 1's "two lazy cats" are slow
  moggies (plus a surprise third).
- **Appointments have a closing time** (the vet closes, a one-tap retry), on top of the three stars.
- **Cat Lady's shift is a clock every boxed cat extends**, so it's endless for as long as you keep up.
- **Personality symbols show when they matter** (acting, near you, always for the Boss), not over every cat all the time.
- **First-time players alone skip the lobby** into Appointment 1, so they're playing within 5 seconds.
- **The round intro is the game's own 3-2-1** on the wall clock (`countdown: 0`), so there's one countdown.

## Structure

```
index.html, vite.config.js (base './'), package.json (build: vite build; test: node --test), onceworlds.json → dist/
src/main.js       join first, screens, the frame loop; poster mode; autoplay (not in production)
src/sim/          rng, tuning, world (rooms, collision), cats (steering, types), people, carriers, levels, rooms,
                  versus, together, catlady, brain (bot brain), codec (cat stream)
src/render/       scene, roomkit, catmesh, personmesh, carrier, fx, camera, post
src/ui/           hud, lobby, book, results, hints, text
src/net/          net (createMatch/createHost/createBots, presence, prediction), fakeroom (tests)
src/audio.js      synth effects and the sequencer
test/             sim, levels (solvable), balance, catlady, codec, net (host reload, leaver, latecomer), full games
```

Pure modules (`src/sim`, `src/net/codec.js`) import nothing from the page, three.js or the SDK, so `node --test` runs them.
