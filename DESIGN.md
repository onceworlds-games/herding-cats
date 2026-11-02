# Herding Cats

## Pitch and goal

**Pitch:** The vet closes in two minutes. Get every cat into the carrier. Cats don't do what they're told.

**Goal in one line:** every cat in the carrier before the clock hits zero.

**What the screen shows, with no words:** a sunny cutaway room, cats everywhere, an open red carrier with **0/6** stencilled
on its side, and a wall clock running down.

**Description (store):** "Get every cat into the carrier before the vet closes. Fifteen appointments with three stars each,
a new Daily every day, rare coats for the Cat-alog and hats, carriers and claps to earn. Alone or with friends."
**Genre:** Party. **Stack:** Vite + three.js, the SDK's `match` and `bots` helpers, fonts from @fontsource.

You can't pick a cat up. You are a person in the room, and cats walk away from you. Everything else follows from that.

## The first minute

A first-time player (no save) who is alone in the server:

| Time | What happens | Hint (2-5 words) |
|---|---|---|
| 0 s | Title: the Cat Café diorama, a bot cat person herding its eight cats round the tables. "Herding Cats" huge over it, one red **Play** button. | none |
| ~3 s | Tap Play (sound unlocks). Appointment 1, *Two Lazy Cats*, in a small studio flat: the headline for 2.4 s, the red carrier with **0/2** on it, two cats, the wall clock at 2:00. | none |
| ~5 s | Control is yours. Gold footprints glow on the floor behind the nearest cat, on the far side from the carrier. | "Stand behind it" (over the cat) |
| ~8 s | You step onto the footprints; the cat flattens its ears and trots away from you, toward the carrier. The clock starts on your first step. | "Push it in" (once it moves) |
| ~15 s | It reaches the gold doormat and squeezes in. The wire door swings, a latch, "mrrp", a red **IN** stamp thumps above the carrier, a hit-stop, the counter pops to **1/2**. | none |
| ~28 s | Second cat in. **2/2**, the carrier wobbles... and a third cat crawls out from under the sofa. The counter flips to **2/3** with a "?!" stamp. (The laugh.) | none |
| ~45 s | Third cat in, in slow motion. "All in!" stamps onto the results: the carrier socket lights, the clock socket (under the 0:25 par), the challenge socket (a Double) if the first two went in together. | none |
| ~50 s | XP counts into the herder bar: level 2, a Beanie to wear. **Next** is the big button (Enter). | none |
| ~55 s | Appointment 2 (*Up on the Sofa*): a cat sits on the sofa back and ignores you. | "Shake treats" + key cap J / the Treats button |

A returning player (or anyone joining a server with people in it) goes Play → the Waiting Room lobby (below). After the first
appointment, the lobby is home: Ready plays a match with bots, Appointments and Cat Lady are the solo content.

A first match: Ready → the platform's 3-2-1 plays over the Waiting Room (the game owns its countdown), then the round's
headline ("Round 1 of 3" over the room's name) for 3 s while the camera shows the whole room, settling on you.

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
  faster it goes. Stop, and it slows and sits, looking back at you. You steer by where you stand. A pushed cat shows a
  chevron where it's heading, gold when that line runs into the door.
- **The tell.** A calm cat that feels you coming first stops and glances at you for 100-180 ms (per type), then bolts.
- **Treats (J):** every cat within 6 u turns and follows you for 2.2 s, stopping 1 u away and begging, then sits content for
  1.4 s before your push applies again. 3.2 s cooldown. A gold dotted ring shows the reach.
- **Clap (K) is a shot:** every cat within 4 u runs dead straight away from you at 6.8 u/s for 0.72 s, banks off walls and
  furniture (keeping 86% of its speed per bounce) and knocks into other cats, which run on along the line between them.
  2.4 s cooldown. While the clap is ready, every cat in reach shows its dotted path with one bounce; gold means it goes in.
  Lining up a bank shot or a knock-on is the advanced game.
- **The door stays open.** Each carrier has a gold doormat (1.5 u wide, 1.1 u deep). A cat on it, moving toward the door
  (within ~70°), squeezes in. Cats in within 2.2 s of each other chain: **Double**, **Triple**, **Cat Train** (stamps,
  confetti, a punch-in and a moment of slow motion). A cat in a carrier stays there.
- **Cats hate carriers.** A calm cat steers gently away from any carrier within 1.5 u. Nothing wanders in by itself.
- **Cornered cats slip past.** A cat pinned by walls crouches for 0.35 s (telegraphed) then dashes past you along the wall.

**Twists** (from appointment 9, and one in every Daily): a **laser pointer** to pick up (cats in 5.5 u chase the dot for 7 s;
in by laser is a trick), a **robot vacuum** (cats flee it, some hop on and ride; a ride in is a trick), the **doorbell**
(three knocks, then every cat in 11 u scatters from the front door), **boxes** you shove about (a cat sits in one and goes
where you push it: a special delivery). Lazy cats nap in **patches of sun** from the windows.

**What a beginner does:** walks straight at cats, chases them around the room, claps when stuck, gets a cat in now and then.
**What an expert does differently:**
- Approaches on a wide arc so the cat never sees them from the wrong side, then pushes on a straight line to the door.
- Gathers two or three cats with treats beside the door, steps round and walks them in as a train for a Triple.
- Claps from the right spot: a bank off the wall beside the carrier, a knock-on through a cat sitting on the mat.
- Saves the clap for Loafs, Zoomers mid-wiggle and shots, never claps near a Scaredy.
- Gets the Boss in first so its gang walks in alone; carries kittens in behind their cat.
- Uses the twists: the laser to pull a crowd to the door, a box to deliver a cat that won't move.
- In Versus: steals herds lined up at a rival's door and claps a rival's treat parade apart.

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

**Coats** are rolled fresh for every cat each try: eight house coats, and now and then something rarer: Fancy (1 in 7:
Silver Tabby, Cream, Ginger & White, Russian Blue, Cow Print, Smoke), Rare (1 in 30: Panda, Bengal, Lilac Point, Midnight)
and Lucky Gold (1 in 150). Rare coats glint in the room; boxing one adds it to the Cat-alog with a sparkle.

**Furniture:** low pieces (sofa, bed, tables, boxes) are perches. An idle cat may hop up (4% a second, 6-15 s); a perched cat
ignores pushes and swishes its tail. Treats or a clap bring it down. Perched cats sometimes swat an object off (a vase, a
mug, a stack of books): it falls and smashes with a crash. Nearby cats flinch; a Scaredy within 6 u hides. Debris has no
collision. Tall pieces (shelves, wardrobes, fridges) are walls. Ponds and railings block people and cats alike.

## Solo

### Appointments: 15 levels

Each level is a room, a fixed set of cats (their coats rolled fresh each try, so a rare one can turn up), a closing time and
three stars: all in, under par, and the room's challenge. Beating the expert time adds a gold rosette. Missing closing time
is "Missed appointment" and a one-tap Retry. The clock starts on the first move; the par is a gold notch on its rim. Each
level introduces one cat or one twist, and the next unlocks when this one is done.

| # | Name | Room (u) | Cats | Closes | Par / Expert | Challenge | New |
|---|---|---|---|---|---|---|---|
| 1 | Two Lazy Cats | Studio 14×12 | 2 moggies (+1 surprise from under the sofa) | 2:00 | 0:25 / 0:15 | A Double | the push |
| 2 | Up on the Sofa | Living room 16×14 | 3 moggies, one perched | 2:00 | 0:35 / 0:20 | No claps | treats, perches |
| 3 | Loaf Around | Bedroom 16×14 | 2 Loafs, 1 moggy | 2:00 | 0:30 / 0:20 | Loaf in one clap | clap, Loaf |
| 4 | Snack Attack | Kitchen 16×12 | Glutton, 2 moggies | 2:00 | 0:25 / 0:15 | A knock-on | Glutton |
| 5 | Zoomies | Hallway 24×8 | Zoomer, 2 moggies | 2:00 | 0:35 / 0:20 | Zoomer mid-sprint | Zoomer |
| 6 | Under the Bed | Big bedroom 18×14 | Scaredy, 3 moggies | 2:00 | 0:40 / 0:25 | Nobody hides | Scaredy |
| 7 | Kitten Pile | Laundry 14×14 | 1 moggy, 3 kittens | 2:00 | 0:20 / 0:10 | A Triple | Kittens |
| 8 | The Boss | Back garden 22×18 | Boss, 3 gang, 1 moggy | 2:30 | 0:50 / 0:25 | Boss first | Boss, pond |
| 9 | Cat Café | Café 22×18 | 8 mixed | 3:00 | 1:20 / 0:45 | In by laser | laser pointer |
| 10 | Quiet Please | Library 22×18 | 2 Scaredy, Loaf, Zoomer, 2 moggies | 3:00 | 1:30 / 0:50 | A bank shot | doorbell |
| 11 | Moving Day | Flat full of boxes 20×16 | 7 mixed | 3:00 | 1:15 / 0:40 | Special delivery | boxes |
| 12 | All Aboard | Boat deck 24×10 | 8, two Zoomers | 3:00 | 1:15 / 0:40 | A vacuum ride | robot vacuum |
| 13 | Greenhouse | Greenhouse 20×16 | Boss, 3 gang, Glutton, 2 kittens, 1 moggy | 3:00 | 1:15 / 0:30 | Boss first | laser + Boss |
| 14 | Rooftop | Roof garden 22×18 | 10 mixed | 3:30 | 1:55 / 1:00 | Two bank shots | vacuum + doorbell |
| 15 | Closing Time | The whole flat 26×20 | 9, every type | 4:30 | 2:30 / 1:20 | Nothing broken | doorways, the laser late |

Par and expert times come from the herder bot's runs (see Balance). A new cat or twist gets a 2.4-second introduction: the
camera frames it with its name and a short tip ("Zoomer: wait for the wiggle", "Laser pointer: grab it, cats chase the
dot", "Doorbell: knock knock, then everyone scatters").

### Cat Lady (endless)

Unlocks after Appointment 5. The Cat Lady's parlour, one carrier, a cat flap. Cats keep coming in through the flap so there
are always 6 loose (rising by 1 every 8 boxed, to 10). The shift clock starts at 1:00 and every cat boxed adds time
(+8 s, shrinking 0.1 s per cat to +4.5 s), a "+8" flying from the carrier into the clock. The mix escalates: moggies, then a Zoomer
from cat 5, a Scaredy from 10, Gluttons and kittens from 15, a Boss gang from 20. The shift ends when the clock does. Score =
cats boxed. A beginner boxes 10-15 (about 1:30); an expert 40+ (5 minutes or more). Leaderboard `cat-lady`.

**How long solo lasts:** first clear of all 15 about an hour, three-starring everything 3+ hours, Cat Lady and Versus with
bots for as long as the player likes.

## Multiplayer

**Public game**, up to 6 per server: `ow.rooms.join({ maxPlayers: 6, minPlayers: 1, lobby: 'bar', ownCountdown: true,
countdown: 3, settings })`. Joined once, by a small classic script (`public/join.js`) that runs before the game's bundle is
even parsed, so a reloaded page has its seat back at once. A lone player readies and plays with bots. The title has one button; the
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
other. The camera follows you (your carrier leaning into frame), so 16-24 cats stay big enough to read. 45 s in, a **laser
pointer** turns up in the middle of the room: whoever grabs it can pull a crowd to their door (55 s in Together). Round 1 has moggies, a Glutton and kittens; round 2 adds Zoomers, a Loaf and a Scaredy; round 3+ adds a Boss gang.
Carrier spots rotate each round.

**Together.** One carrier, all the cats, beat the clock. 2:30 rounds; cats = 6 + 2 per seat. Team stars per round:
★ all in, ★★ with 0:30 left, ★★★ with 1:00 left (gold notches on the clock's rim). Results show the team's stars and who boxed most (the last person to push
each cat gets the credit).

**Rounds and timing.** `createMatch` with `rounds: 'rounds'`, `introSeconds: 3` (the round's headline over the room; the
3-2-1 before it is the game's own countdown, drawn over the Waiting Room), the clock in the round data, 120 s (Versus) / 150 s
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

**Latecomers** watch (the platform's "Watching" note; our camera follows the leader) and join at the next round
(`admit: 'next'`; at each round's end the host admits everyone online who isn't idle and isn't busy in an appointment). **Leavers** keep their seat and points; their person poofs away; in Versus their carrier door shuts
with a "Closed" sign. **Away** players' persons stand dimmed; their carrier stays open. **Host change:** the new host rebuilds
the cat simulation from the last snapshot (`resume`). A reloaded page restores its person from `room.me.presence`.

**Solo while waiting.** Appointments and Cat Lady run from the lobby (`room.hideLobby()` while they run). A solo run ends
cleanly (back to the Waiting Room) when a match starts with this player in it. A private server's host never sits in an
appointment while friends are there: the tickets say "Friends are here" and are shut, and a run in progress ends as soon as a
friend arrives. In a public server, a player busy in an appointment who isn't ready is left out of the match, keeps
playing, and joins the next one; the others see "At the vet" over their person.

**Netcode.**
- **Presence** (every page, 20 Hz): `{ x, z, h, v, tr, cl, s, rk, r }`: position, heading, speed, a treats counter and a
  clap counter (each press adds 1), screen (`title` | `lobby` | `book` | `solo` | `play`), herding rank, round id (so a
  reload in the middle of a round carries on from where the page was). Others are
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
  now with this page's recorded movement; the drawn cat keeps where it was and eases to the corrected spot over about
150 ms, so cats never visibly snap. Boxing, hiding, perching and
  scores happen only when the host says; a cat on a doormat hesitates (the 0.35 s pull-in), which covers the wait.
- **Scores** are the host's counts; `score(m)` returns them; the host writes results and ends the match.
- No custom messages. Budget: host ~10 state writes/s + presence; others presence only.

## Progression and reasons to come back

Short goals every few seconds (the next cat, a Double, a bank shot), mid goals every few minutes (a room's three stars, a
level-up and what it brings), long goals over days (the herder track to 30, four Cat-alog pages, the Daily streak).

- **Three stars per appointment, each a different job:** a carrier (all in), a clock (under par) and the room's own
  challenge (a Double, no claps, the Loaf in one clap, a knock-on, a Zoomer mid-sprint, nobody hides, a Triple, Boss first,
  in by laser, a bank shot, a special delivery in a box, a vacuum ride, two bank shots, nothing broken). The challenge shows
  as a chip under the platform menu while you play and lights up (or goes grey) the moment it's done (or lost). A gold
  rosette for beating the expert time. 45 stars.
- **Herder level (1-30).** XP for every run: 10 a cat, 15 for each extra cat in a combo, 20 a trick shot (bank, knock-on,
  laser, ride, delivery), 25 the first time a room is kept, 60 a new star, 120 a new rosette, 30 a challenge done again,
  20 a personal best, 150 the day's first Daily (+25 a day of streak, up to +150), 60 a goal and 120 all three, 25 a round
  played and 80 a match won, 40 a new Cat-alog face and 200 a page filled. Level n needs 120 + 60(n−1). Every level brings
  something to wear (`LEVEL_ITEMS`): eleven hats, nine carrier shells, six clap bursts, seven trails.
- **Things to wear** (the Wardrobe): a hat on your person, a shell for your carrier (solo), a clap burst (hearts, stars,
  confetti, bubbles, notes, fish) and a trail of prints (paws, hearts, flowers, sparkles, fish, stars, rainbow dots). Others
  see your hat, clap and trail in matches (three small numbers in presence, checked by every page).
- **The Cat-alog.** Every cat you box is counted by personality and coat. Coats are rolled per cat (the coat a room
  names, or by chance: uncommon 1 in 7, rare 1 in 30, legendary Lucky Gold 1 in 150). A rare coat glints across the room; the first of each gets
  a stamp as it goes in. Four pages (Personalities, House Cats, Fancy Coats, Rare & Lucky), each with a reward (Cat Ears, the
  Calico carrier, the Rainbow trail, the Gold carrier).
- **The Daily.** From appointment 3: one room for everyone each UTC day (`dailySetup(day)`: a level room, 5-7 cats, one
  twist, a challenge, a par from the bot fit). A streak for keeping it on consecutive days, its own board where today's
  times outrank older ones (score = day × 10000 + 9999 − tenths), and a counter of how many herders kept it today
  (`ow.data.game` `dailyHerders`, reset daily).
- **Today's goals.** Three a day from a seeded pool (box 15-30 cats, Doubles, a Triple, bank shots, knock-ons, trick shots,
  stars, challenge stars, a room with no claps or no treats, pars, a Cat Lady shift of 10-20 once it's open, Versus rounds when
  others are online), fixed once seen that day. XP for each and for all three.
- **Leaderboards:** `appt-01`…`appt-15` (best time), `daily`, `cat-lady`, `stars`, `cats-boxed`, `herder` (level). 20 boards.
- **Badges (16):**

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
| `cat-train` | Cat Train | Box four cats through the door in one go. |
| `bank-shot` | Bank Shot | Bounce a clapped cat off a wall into the carrier. |
| `rare-coat` | Rare Coat | Box a cat with a rare coat. |
| `cat-alog` | Cat-alog | Fill every page of the Cat-alog. |
| `week-of-dailies` | Week of Dailies | Keep the Daily seven days in a row. |
| `herder-10` | Herder Level 10 | Reach herder level 10. |

Save (`ow.save`, key `hc`, `src/meta/progress.js`): `{ v: 2, levels: { n: { s (star bits), best, ros } }, catLady, boxed,
wins, xp, wear, fresh, book: { coats, types }, daily: { last, streak, best, day, time, s }, goals: { day, list, prog, done },
seen, hints }`. Version 1 saves migrate (old star counts become star bits, XP is estimated, finished rooms fill the book).
Everything read from a save is checked and clamped. Written when a run, shift or match ends, never per frame.

## Balance and timing

Every number lives in `src/sim/tuning.js`.

| | Value |
|---|---|
| Person | 4.6 u/s, full speed in 0.11 s, stops in 0.08 s, radius 0.35 u |
| Flee (moggy) | radius 3 u; 2.0 u/s at the edge rising to 4.0 u/s close; a calm cat glances for 0.11-0.15 s first; turns at up to 11 rad/s fleeing (4.2 calm); keeps going 0.5 s after you leave, then slows over 0.4 s |
| Calm | walks 1.5 u/s in bursts, sits a few seconds; naps in a sun patch within 7 u (Loafs and Gluttons always, Zoomers rarely) |
| Treats | radius 6 u, lure 2.2 s at 2.2 u/s, stop at 1 u, content 1.4 s, cooldown 3.2 s |
| Clap | radius 4 u, a shot at 6.8 u/s for 0.72 s (86% kept per bounce, cats knocked on), then a 3 u/s trot for 0.55 s; cooldown 2.4 s |
| Door | mat 1.5 × 1.1 u, entry within ~70° of the door and above 0.5 u/s, pull-in 0.3 s; combos within 2.2 s |
| Cornered slip | blocked 0.4 s → crouch 0.35 s → 4.5 u/s for 0.8 s along the wall |
| Zoomer | walk 2 u/s, flee up to 4.4 u/s, wiggle 0.7 s, sprint 7 u/s × 1.2 s, every 5-9 s |
| Scaredy | flee radius 5 u, 2.0-4.6 u/s, hides on a clap within 8 u or a crash within 6 u, creeps out at 1.2 u/s |
| Glutton | walk 1 u/s, flee radius 2.6 u, max 2.8 u/s, treats from 14 u at 2.8 u/s for 3 s |
| Kitten | follows at 1 u, flee radius 2 u, follows in within 4 u after 0.8 s |
| Boss | flee radius 3 u, max 2.4 u/s, clap → 2.5 u/s for 1 s, gang within 6 u, the gang marches in at 1.8 u/s |
| Loaf | a clap scoots it 3.6 u over 0.8 s |
| Laser | picked up within 0.75 u; cats in 5.5 u chase the dot (4.6 u/s) for 7 s; back after 14 s |
| Robot vacuum | 1.25 u/s, scares cats in 2 u, 35% hop on and ride |
| Doorbell | 1.8 s of knocks, then every cat in 11 u bolts from the front door |
| Boxes | a cat within 4 u may sit in one (55%); a shove moves box and cat |
| Simulation | fixed 30 Hz step; seeded RNG per round; cat-cat separation 0.62 u |
| Versus | 2:00 rounds, 4 cats per seat, 3 rounds |
| Together | 2:30 rounds, 6 + 2 cats per seat, stars with 0:30 and 1:00 left |
| Cat Lady | clock 1:00, +8 s a cat (−0.1 s per cat, at least +4.5 s), 6 loose rising by 1 every 8 to 10 |
| Daily | one seeded room, mix and twist for everyone; par from bot runs |
| Bots | skill 0.35-0.7 in public, scaled by the table's rank |

**How they're checked (`npm test`, node tests on the pure modules):**
- The herder bot at skill 1 boxes every cat of every appointment (twists included) within par in most seeds, and its best run
  beats the expert time (`tools/calibrate.mjs` sets par and expert from these runs).
- Every Daily is winnable, and its par sits near the bot's median.
- Versus with 2, 4 and 6 equal bots: at least 85% of cats boxed in 2:00, no runaway leader; a much better herder wins most
  matches but not all.
- Together with 1, 3 and 6 seats: all in for a good team, two stars reachable (three with three seats).
- Cat Lady: an average shift lasts a couple of minutes, a great one goes on and on.
- Every room: no cat or person inside furniture or outside the walls, no NaN.
- The net session with fake pages: prediction and corrections, a host reload, a leaver, a latecomer.

## Every screen

All screens keep clear of `ow.ui.reserved` (re-read every half second; the clock drops under the menu on narrow screens). Words in Fraunces, numbers in Big Shoulders
Stencil. Buttons are solid blocks of a palette colour with a 3 px espresso outline and a 4 px hard offset shadow (no blur, no
gloss), ≥ 56 px tall on phones, key caps shown on desktop.

1. **Title.** The Grand Café diorama in attract mode (a bot herding, cats perching and swatting, the camera drifting). "Herding
   Cats" in Fraunces Black, cream with a thick espresso outline, its letters dropping in and swaying. A red Play button
   (tap, click, Space or Enter). Once you've played: a strip with your herder card (level, the XP bar) and chips for stars
   and the Daily streak.
2. **Waiting Room (lobby).** A vet's waiting-room diorama: rows of red chairs, a rug, cats wandering and dozing. Each player
   stands at the back with their carrier (seat colour and symbol) beside them, their name above, a bell for the host, a
   check when ready; a "+ Invite" tag after the last one (`ow.ui.showInvite()`). Beside the scene (below it on portrait):
   the **settings board** (Versus | Together, Rounds 1 | 3 | 5; the host taps, others see them lit), your herder card (opens
   the wardrobe), then three tickets with a picture of the room: **Appointments** (stars), **Daily** (the streak flame) and
   **Cat Lady** (best), padlocked until earned. First-time players see a red "Start here". The platform's Ready strip sits at
   the bottom.
3. **Appointment Book (the solo hub).** Left column: the herder card (level, XP bar, the next unlock), today's three goals with
   their bars, the Daily ticket (today's room, mix and twist, your best, the streak, how many herders kept it today), Cat
   Lady, then Wardrobe (a dot when there's something new) and Cat-alog. Right: fifteen appointment cards, each a rendered
   picture of its room with the number, the new cat or twist, the three star sockets (carrier, clock, the challenge's icon),
   the best time and a gold rosette for the expert time; locked ones say how to open them. The next one nudges.
4. **Wardrobe.** Your person stands in their room with the camera beside the panel; tabs for Hats, Carriers, Claps and Trails,
   every item as a picture (locked ones show the level they come at), "New" on fresh ones. Picking one tries it on in the
   scene (the hat on your head, the carrier shell beside you); Wear keeps it.
5. **Cat-alog.** Four pages (Personalities, House Cats, Fancy Coats, Rare & Lucky) of portraits rendered from the game's own cat models;
   unseen ones are blurred silhouettes with a "?", rare ones sit on coloured backdrops. A full page pays a reward to wear.
6. **Level intro (2.4 s).** The headline ("Appointment 9" over *Cat Café*); a new cat or twist gets the camera and its tag.
7. **Play HUD (solo).** Top centre: the wall clock (a cream face, espresso rim, red second hand, a gold notch at par) with the
   time in big stencil numerals; red and ticking under 0:30, pulsing under 0:10. Top right: a carrier glyph with **3/6**. Top
   left: the room's challenge as a chip that lights (with a chime) when done. Under your person, a floor ring: its gold half is Treats, its
   cream half is Clap, each drained on use and refilling. Off-screen: an edge arrow to your carrier and paw arrows to the
   last cats. Combo and trick stamps over the carrier. On desktop, bottom right: the two key caps with the same sweep.
8. **Results.** A panel beside the carrier (a sheet from below on portrait), told in order: "All in!" (or "Missed
   appointment") stamped on, the time ("New best"), the three sockets lighting one by one, the expert rosette, XP lines
   counting into the herder bar (a level-up with what it brings and a Wear button), new faces for the Cat-alog, a finished
   page, the room's top times. Buttons: **Next** (Enter; Retry when missed), Retry (R), Book (Esc). A tap skips the telling.
9. **Pause (solo).** The scene freezes and darkens a little; a card: Resume (primary), Retry, Book.
10. **Cat Lady.** HUD: the clock (each boxed cat sends a "+8" into it), boxed count big at top right. End: "Shift over", the
   count, best, top 5, Retry (primary), Lobby.
11. **Round intro (3 s, multiplayer).** "Round 2 of 3" over the room's name, large, while the camera shows the whole room.
12. **Play HUD (multiplayer).** The clock as in solo. Versus: top right, your carrier glyph and count (big); under it a column
    (a row under the clock on portrait) of every seat's carrier glyph with its symbol and count, the leader's wearing a gold
    rosette. Names over heads. Together: one counter on the shared carrier, the clock rim shows the team star notches.
13. **Round end (5 s).** The whole room; a headline: "Priya wins" with the cats (Together: "All in!" with the time left and
    the team's stars).
14. **Match results.** "Best in Show!" (or "Priya: Best in Show") over the standings: place, seat symbol, name, total cats;
    confetti and a fanfare. Host of a private server: a Lobby button; a public server goes back by itself after 25 s.
15. **Watching.** The match, camera on the leader; our own "Next round" note once admitted.
16. **Room closed.** One message, one button: "You were removed" + Play; "Connection lost" + Rejoin; "Playing in another tab"
    + Play here. Each re-joins with the same options.

## Art direction

**The world:** miniature cutaway apartments, as if a set designer built tiny lived-in rooms on a tabletop. Each room is a slab
with a dark cut section, two back walls (wallpaper, wainscoting, skirting, windows with a view and curtains, paintings) and
the front walls cut down to a low stub, floating over a warm dark backdrop. Furniture is CC0 (Quaternius' House Interior,
Kenney's Furniture Kit) recoloured into one palette; floors are ambientCG wood and tile, and carpets woven in each room's
colours over the ambientCG pile (a sage trellis with gold rosettes under the libraries' burgundy walls, rose sprigs in the
parlour, little cream flowers on blue in the bedroom). The things that make it a cat household are made in code: bookcases
full of books, rugs with fringes and a medallion, oval braided rag rugs in the emptiest floor, bowls on
a mat, pet beds, scratching posts, cushions, feather wands, yarn balls and toy mice that roll away when a cat or a person
runs through them, slippers by the door. Late sun pours through the back windows: bright window patches on the floor, light
shafts with drifting dust, soft shadows, contact shadows baked under every footprint.

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

**Lighting and camera:** late-afternoon sun low in the north-west through the back windows (soft shadows from a shadow camera
fitted to the room), a hemisphere fill, ACES tone mapping. A **perspective camera with a long lens** (30° FOV, 52° pitch,
from the south-east), so the room reads as a miniature: it follows you with a little look-ahead, leans toward the carrier,
punches in on combos and slows time for the last cat. Above low quality: bloom, a tilt-shift blur (sharp across the middle
band), a warm grade (shadows toward plum) and a vignette. Tall pieces between the camera and a cat dither out.

**Cats** are the stars: one skinned model per cat, generated in code from a body plan (a body sweep, a head with cheeks and
muzzle, ears, four jointed legs, a long tail) with seven builds (the Kitten's big head, the Glutton's belly, the Zoomer's
long legs, the Boss's jowls and torn ear). A fur shader paints coats from the body's own coordinates: tabby stripes and the
forehead M, tuxedo bibs and socks, calico patches, tortie mottle, Siamese points, and the rare coats (Silver Tabby, Panda,
Lucky Gold, Midnight and more), which glint. Eyes with pupils that go round when scared, lids that blink. A procedural
animator blends gaits from speed (walk, trot, gallop), the startle hop, ears back, the arched hiss with a bottle-brush tail,
the butt wiggle, loafing, curled sleep, grooming, perching with the tail hanging, squeezing in through the carrier door.

**People:** CC0 animated characters (Quaternius) with real idle, walk, run and clapping clips, dressed from the player's avatar
colours, wearing the hat they picked. Treats: the pouch up and rattled with gold sparkles. Clap: hands together over the
head, a shockwave ring in the clap's colours.

**HUD in the world's language:** the timer is the room's wall clock; the score is stencilled on carriers; results are stamps;
hints are short words floating over the thing they're about. No boxes behind HUD items: white or cream text with a thick
espresso outline, or a solid band where needed.

## Sound

Two layers through a light room reverb. **Recorded** (Kenney, CC0; trimmed, normalised and joined into one 275 KB
`public/sfx/sprite.mp3` by a script, offsets in `src/sfxsprite.js`): footsteps per floor (wood, carpet, stone, grass), the
carrier's metal latch, a leather treat pouch, wood knocks, glass and plate breaks, a bell, a tin bump, soft thuds, book
pages, cloth, chips and coins, UI clicks, toggles and ticks, and jingles (sax for all in and the sad trombone for a miss,
steel drum for a level-up, pizzicato for a full Cat-alog page). **Made** in Web Audio: meows (formant-filtered saw with a
contour per cat), purrs, hisses, grumbles, the clap, the kibble in the bag, the stamp's thump, star tinks, the jazz trio.
Until the sprite has loaded, the made sounds play alone.

| Moment | Sound |
|---|---|
| Push | a "mrt" per cat (kitten high, Boss low) |
| Treats | the pouch and the kibble; purrs from lured cats |
| Clap | the clap into the room, a soft thump; hisses |
| In | the latch, a "mrrp", the stamp's thump |
| Combo | a star tink rising per cat |
| Knock-on, bumps | wood knocks; the robot vacuum is tin |
| Doorbell twist | three knocks on the front door, then ding-dong |
| Crash | glass and plate |
| A new coat | a page; a rare one gets a glass ping and a ta-da |
| Results | each star a tink, each XP line a chip, unlocks a coin purse and a rise |

**Music that builds:** the jazz trio (112 BPM, swung, Gm7-C7-Fmaj7-D7, phrases picked by seed) follows the carrier. Empty:
walking bass and a ride. A sixth in: brushes. A third: comping chords. Half: the vibes' tune on the beat and a soft kick.
Two thirds: the whole tune. Five sixths: the tune doubled an octave up and more comping. The last 30 s go to 132 BPM with
staccato stabs. Menus play bass, ride and brushes, quieter.

## Store art and trailer

Posters (deterministic, `?poster=<name>`, real renderer, no HUD):
- **cover** (1280×720): the studio flat in late sun; a person walking a train of four cats toward the red carrier (3/9 on
  its sign), a white cat up on the coffee table, a Zoomer sprinting off, toys and a braided rug about. "Herding Cats" once,
  big, top right.
- **action** (1280×720): close on a treats shake: the gold ring of reach going out, a Glutton, a ginger and a kitten
  turning and trotting to the pouch.
- **win** (1280×720): the carrier with 6/6, the last cat squeezing in, confetti; "All in!" and the three star sockets lit
  (carrier, clock, a Cat Train).
- **multi** (1280×720, thumb-4): Versus in the loft, four herders and four carriers in their colours and symbols with their
  counts, cats everywhere.
- **icon** (512×512): the red carrier and a ginger cat on its doormat in a patch of sun. No text.
- **badge-<id>** (256×256): a bold symbol on a palette disc, one per badge (16).
- **card-<n>**, **card-catlady** (480×300, `public/ui/rooms`): each room with its cats where they start, for the book.

**Trailer (`store/trailer.mp4`, 27 s, 1280×720, 30 fps, H.264 + AAC, 18 MB):** autoplay captures (`?autoplay=1&scene=...`,
`&zoom=` for a closer following camera; never on onceworlds.com), the herder bot playing, the game's own sound; hard cuts,
each shot's sound crossfading 0.12 s into the next.
1. 0-6.6 s: Kitten Pile. The herder sprints, kittens tumble toward the carrier: IN, Double!, Triple!, a clap, Cat Train! 4/4.
2. 6.6-11 s: Appointment 1. A cat trotting along its dotted path, IN, 2/2... and a third cat pops up: 2/3.
3. 11-15.6 s: Cat Café. The laser pointer leads a cat in, then a clap sends three more: Triple!
4. 15.6-20.8 s: Versus in the Reading Room: four herders in their colours, IN, Double!, Cat Train!
5. 20.8-23.8 s: "All in!" 0:07.0, the three stars lighting up one by one.
6. 23.8-27.2 s: "Herding Cats" over the café diorama, the bot still herding below.

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
- **The game owns its countdown** (`ownCountdown: true`, 3 s): one 3-2-1 over the Waiting Room, then the round's headline.
- **Carrier shells are solo only.** You earn and wear shells for your own carrier in solo play; in Versus and Together the
  seat colours and symbols stay the identity. Hats show everywhere.
- **Three different stars** (all in, par, a challenge per room) instead of three time thresholds, plus an expert rosette.
- **Twists** (laser pointer, robot vacuum, doorbell, boxes, sun patches) arrive from appointment 9 and in the Daily.
- **The clap is a shot** that banks and knocks on, and **the door stays open** so trains of cats chain combos (the spec shut
  it for 0.6 s after each cat).
- **The title's café is the Cat Café level** played by the bot, rather than a separate diorama.

## Structure

```
index.html, vite.config.js (base './'), package.json (build: vite build; test: node --test), onceworlds.json → dist/
public/join.js    joins the server as the page loads (a classic script, before the bundle)
public/assets/    the furniture kit and people (glTF, meshopt), surface textures
public/sfx/       sprite.mp3: every recorded sound in one file (offsets in src/sfxsprite.js)
public/ui/        rendered pictures for the screens: room cards, the cat sheet, the wear sheet
src/main.js       screens, input, the frame loop, solo runs, matches, autoplay (never on onceworlds.com)
src/poster.js     ?poster=<name>: the staged store pictures and room cards; sheets.js the picture sheets; studio.js the
                  cat studio
src/sim/          rng, tuning, kit (furniture), world (collision), rooms, game (cats, people, carriers, treats, the clap
                  shot, the door, twists), coats, sun (window patches), levels, daily, brain (the herder bot), runs (whole
                  games for tests), codec (the cat stream)
src/meta/         herder (XP, levels, things to wear), progress (what a run does to your save), challenges, goals, catalog
src/net/          session (a round's simulation on a page: host, prediction, presence), net (the SDK side: match, bots)
src/render/       stage (renderer, camera, light, post), assets, room (rooms, decor, toys, falling props), catmesh,
                  catshader, catanim, cats, people, carriers, twists, guides (push chevrons, clap paths), fx, view, palette
src/ui/           ui (buttons, the clock face, stamps), screens (herder card, book, daily, wardrobe, Cat-alog), results,
                  icons, symbols, sheetlist
src/audio.js      the sound sprite, made sounds, the jazz trio that fills with the carrier
src/save.js       progress through ow.save, badges and leaderboards
test/             sim, rooms, levels (every appointment within par), balance (versus, together, Cat Lady), meta
                  (XP, stars, Cat-alog, Daily, goals), net, shots (the clap shot, combos, twists)
```

Pure modules (`src/sim`, `src/meta`, `src/net/session.js`) import nothing from the page, three.js or the SDK, so `node --test`
runs them.
