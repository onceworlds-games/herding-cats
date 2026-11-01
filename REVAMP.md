# Herding Cats: teardown and rebuild plan

Played from the `main` build (19b7757) headless: Appointment 1 with the herder bot at full skill (16 s), the Versus and
Kitten Pile takes from the first trailer, the store art. Compared against the games of its kind people come back to:
Untitled Goose Game (one strong look, physical comedy), Overcooked and Moving Out (readable chaos, combos of small wins),
Pikmin (lead a crowd, see it follow), sheepdog trials (pressure you can read), Neko Atsume (cats you collect), Peggle and
golf games (a shot you line up, a preview, a payoff).

## What's wrong

### It looks cheap
1. **The cats are specks.** The camera frames the whole room, so a cat is 30-40 px long on a 1280×720 screen and about 15 px
   in Versus. Its ears, eyes and tail (the whole point of a cat) can't be seen. At store-card size they're crumbs.
2. **The cats are primitives.** Instanced spheres, cones and stick cylinders: no face, no fur, no paws, legs like pins.
   Every personality is the same blob with a different colour. Nothing about them says "cat" up close.
3. **The rooms are empty boxes.** A huge flat plank floor, a few flat-coloured boxes for furniture, plain green wall planes
   with pale rectangles for windows, a brown void around. No clutter, no texture, no light coming in, nothing lived in.
4. **Flat light.** One sun and a hemisphere: no contact shadows, no sunlight on the floor, no bloom, no depth of field, no
   colour grade. The "tilt-shift miniature" of the pitch never happened.
5. **The people are dolls made of capsules** with a stiff walk; the clap is an arm lift.
6. **The HUD is fine but the screens around it are generic:** white tickets with buttons in a row, a plain list for results,
   a small static wordmark on the title.

### It moves stiffly
7. **Herding is slow.** The expert bot needs about 20 s per cat on the first, easiest appointment. A push produces a glance,
   then a slow trot. The first 10 seconds are walking in circles.
8. **You can't see what a push or a clap will do.** The only skill in the game (where to stand) is invisible until it
   fails. No line, no target, no "that one's going in".
9. **The door punishes good play:** it shuts for 0.6 s after each cat, so the best move (a train of cats) bumps off.
10. **Going in is a fade.** A cat shrinks into the carrier. No squeeze, no wobble, no paws, no payoff.
11. **Little juice:** a dust puff and an "IN" stamp. No hit-stop, no fur, no camera that leans in, no slow-mo on the last cat,
    footsteps and meows are the only life.

### Nothing to come back for
12. **No short-term goals** beyond "the next cat": no combos, no streaks, no near-misses that pay.
13. **Stars are only about time**, so every appointment is played the same way, once.
14. **No progression:** no levels, no unlocks, nothing to wear, nothing to collect. The cats (the best idea) aren't
    collectible.
15. **No daily reason:** no daily appointment, no goals, no streak.
16. **Versus is unreadable:** 16-24 crumbs in a 24×20 diamond; you can't tell your herd from someone else's.

## The rebuild

### Look: a sunlit miniature apartment
- **Cats as hand-built rigged models**, generated in code from a cat body plan (body sweep, head with cheeks and muzzle,
  ears, four jointed legs, an 8-bone tail) and skinned to a 30-bone skeleton. Seven builds (the Kitten's big head, the
  Glutton's belly, the Zoomer's long legs, the Boss's jowls and torn ear). A fur shader paints real coats from the body's
  own coordinates: tabby stripes and the forehead M, tuxedo bibs and socks, calico patches, tortie mottle, Siamese points,
  and rare coats. Big eyes with pupils that go round when scared and slit when calm, lids that blink.
- **Procedural animation with blended poses:** walk/trot/gallop gaits from speed, startle hop, ears back, arched-back hiss
  with a bottle-brush tail, butt wiggle before a zoom, loaf, curled sleep, grooming, perching with a dangling tail,
  squeezing into the carrier, belly-sliding Loaf, tumbling when knocked.
- **Rooms from CC0 furniture (Kenney Furniture Kit, Quaternius House Interior)** recoloured to one palette, real wood,
  tile and carpet textures, wainscoting and wallpaper, windows with a view, picture frames, plants, books, cat trees,
  bowls, toys. Late sun pours through the back windows: bright window-shaped patches on the floor, light shafts with dust,
  soft shadows, contact shadows baked from every footprint.
- **A perspective "miniature" camera:** narrow lens, follows you with look-ahead, frames you, your target and the
  carrier, punches in on a combo, slows time on the last cat. Bloom, tilt-shift blur, warm grade and vignette above low
  quality.
- **People:** CC0 animated characters (Quaternius) with real Walk, Run, Idle and Clapping clips, dressed in the player's
  avatar colours plus unlockable hats and bags.
- **Carrier as the signature:** a chunky red plastic carrier with a wire door that swings, the count stencilled on it,
  cats' faces at the grille, a squash and wobble for every cat.

### Feel: a push you can read and a clap you can aim
- Snappier herding (faster person, faster reactions, bigger cats, smaller denser rooms).
- **Push arrows:** a pressured cat shows where it will run; the arrow turns gold when it's lined up with the door.
- **The clap is a shot:** cats in reach bolt in a straight line, bounce off walls and furniture, knock other cats along.
  While the clap is ready, every cat in reach shows its dotted path (with one bounce); gold means it goes in. Bank shots
  and chain knocks are the advanced game.
- **The door stays open:** cats in within 2 s chain a combo (Double, Triple, Cat Train) with stamps, hit-stop and a punch-in.
- Juice everywhere: fur tufts, dust, sparkles, hearts, confetti, shockwaves, trails, layered sound (CC0 Kenney foley plus
  synthesized meows, purrs and hisses), music that adds layers as the carrier fills.

### Depth and reasons to come back
- **Three stars that differ:** all in, under par, and a challenge per appointment (Double in, no claps, Boss first, a bank
  shot, Loaf in one clap...). Fifteen appointments rebuilt round the new verbs, each adding a cat or a twist.
- **Twists:** a laser pointer pickup (cats chase the dot), a robot vacuum (cats flee it, sometimes ride it), the doorbell
  (everyone scatters), cardboard boxes cats sit in, sun patches the lazy ones nap in.
- **Herder level** from XP (cats, combos, stars, wins) with an unlock at every level: hats, outfits, treat bags, clap
  effects, footprints.
- **The Cat-alog:** every coat you box is collected; uncommon and rare coats (Silver Tabby, Panda, Lucky Gold, Midnight...)
  turn up now and then with a sparkle. Pages complete for rewards.
- **Daily Appointment** (same room and cats for everyone, today's board) with a **streak**, and **three daily goals**.
- Cat Lady (endless) keeps its shift clock; combos buy extra time.
- Versus in smaller rooms with a following camera, the laser pointer as the mid-round fight, combos and steals.

### Order
1. Cat model, fur shader, rig and animation. 2. Stage, camera, light, post. 3. Rooms and assets. 4. People, carrier, effects.
5. Herding rules (clap shots, previews, combos, twists), with tests and bot balance. 6. Screens, progression, Cat-alog,
daily. 7. Sound and music. 8. Levels and balance. 9. Store art, trailer, docs.
