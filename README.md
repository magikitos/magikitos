# ✨ Magikitos — The Adventure

A top-down pixel-art adventure set in the world of the Magikitos: warm art,
original characters and music, and not a single reflex test.

> **Status: playable development build, also published at `/aventura`.**
> The normal website remains separate. Local changes in
> this repository are not deployed automatically by any of the development tools.

---

## What the game is

The game combines personal adventures with a [shared woodland](docs/SHARED-FOREST.md):
cats, cooking, bottle navigation and community construction, backed by
[private API saves and server-authoritative materials](docs/GAME-SAVE-API.md).

Current art direction: [Ascua and the approved compact cast](docs/art-direction/DUENDES.md),
[2× integrated textures and selective motion](docs/art-direction/DEFINITION-MOTION.md).
Current controls, Brizno and the restaurant story notes: [mobility and Brizno](docs/MOBILITY-BRIZNO.md).
Click intentions, live obstacle avoidance and regression tests: [navigation](docs/NAVIGATION.md).
For operations and verified delivery, see [releasing](docs/RELEASING.md) and
[the current release ledger](docs/RELEASE-AUDIO-2026-09-16.md).
The [entry and audio implementation](docs/AUDIO-AND-ENTRY.md) covers music,
river ambience and fullscreen. [Mobile packaging and store workflows](docs/MOBILE.md)
documents the shared Capacitor projects, TestFlight/Play steps and outstanding
native validation; no native app has been built or published to stores.
The [health review and next steps](docs/HEALTH-AND-NEXT-STEPS-2026-09-16.md)
distinguish verified behavior from remaining maintenance and device testing.
The [next-chapter proposal](docs/NEXT-CHAPTER-PROPOSAL.md) is a discussion, not
implemented gameplay or an approved development commitment.
The [resident and island guide](docs/ISLET-AND-RESIDENTS.md) covers the preserved
100-NPC library, scene casting, open houses and expanded island.

You play a small duende with a pointed hat. You wander, poke at things, pick
up objects, solve little puzzles and pull harmless pranks. That's it, and
that's on purpose.

- **No combat, no death, no timed challenges, no reflex tests.**
- An open world that grows through interlinked local adventures. Each area has
  its own identity and can open the way to the next through what you do.
- Humour is everyday and cheeky, never at another player's expense.
- Movement is calm. The magic works slowly.

The world is a 128 × 96 tile exterior — a starting clearing, forest, human
picnic, a village on grass, the boat lake and a night campfire corner — plus
separate interiors and a 64 × 48 inhabited islet you reach by boat. Five substantial
128 × 144 river reaches connect to shared forest clearings, a 128 × 96 human
garden and a communal refuge. The former
picnic pond has been removed; the navigable river is its own adventure.

---

## The world it belongs to

The **Magikitos** are mischievous, easygoing creatures whose job in the world
is to act as the **Guardians of Everyday Joy**.

Legend places their birth in the **forests of Taramundi**, where they have
lived since time immemorial keeping the peace and the good mood of the place.
They are forest creatures, but they feel a strong pull toward human homes,
which they visit often to get on with their purpose.

Their nature is dual. They keep the playful, mischievous streak of the old
Trasgos — they will hide small objects and cause mild disorder — but the
intent behind it is always positive: protecting humans from monotony, boredom,
bad moods, loneliness and unfairness.

### The Magikito philosophy

|                                      |                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🐌 **Live unhurried**                | They move with absolute patience. Their magic works slowly, building calm or creativity day by day, as an act of resistance against the rush of the modern world.       |
| 🎨 **The beauty of the imperfect**   | They are not symmetrical or conventionally pretty. Uneven features, crooked smiles, odd details. That imperfection is the point — it is their authenticity, their soul. |
| 💫 **Joy as resistance**             | Their presence in a home is an active push against stress, anxiety and bad news; a reminder that calm and joy are necessary, not optional.                              |
| 🤝 **Community over the individual** | They never act alone. They form a tribe, and they encourage that same sense of community in the home they protect.                                                      |

### The 12 Magic Sparks

The most distinctive part of Magikito folklore is their role as carriers of the
**Sparks** — twelve specific energies a Magikito radiates into the home it has
chosen. A person does not pick a Magikito; they are drawn to the Spark they
most need at that point in their life. One Magikito may carry several.

| Spark             | What it brings                             |
| ----------------- | ------------------------------------------ |
| 🧘 **Calm**       | Serenity, inner peace, unhurried breathing |
| 🎨 **Creativity** | Inspiration, the flow of ideas, the muse   |
| 😄 **Joy**        | Laughter, good humour, light on dark days  |
| 🛡️ **Protection** | Safety, shelter, healthy boundaries        |
| 🗺️ **Adventure**  | Exploration, curiosity, nerve for the new  |
| 🌿 **Nature**     | Connection with the earth and the organic  |
| 🏡 **Home**       | Belonging, refuge, roots                   |
| 💝 **Love**       | Tenderness, affection, deep connection     |
| 🍀 **Fortune**    | Good luck, opportunity, fresh starts       |
| 📚 **Wisdom**     | Perspective, patience, clear sight         |
| 👥 **Friendship** | Connection, community, honest bonds        |
| 🌙 **Dreams**     | Deep rest and the world of dreaming        |

### Kinds of Magikitos

**Duendes** — the household guardians, and the heart of the world. Earthy
spirits bound to a specific place, usually a human home. They get specific
roles from the Sparks they carry: kitchen duendes, sleepy duendes (Dreams),
home protectors (Protection). Mischievous, but fundamentally benevolent: they
keep the emotional balance of a house, encourage creativity, or simply watch
over the calm. The most down-to-earth and practical of the Magikitos.

**Animagikitos** — small animals granted Magikito powers to protect some remote
corner of the forest. Usually little mice, for their knack of getting anywhere,
but a sheep or even a cow works just as well.

---

## Repository layout

```
public/assets/js/adventure/   the engine — scenes, renderer, input, rules, save…
public/assets/js/aventura.js  bundle entrypoint
public/assets/aventura/       shipped art packs + manifest
data/aventura/
  catalog.json                world catalogue
  element-families.json        authored visual families and placement capabilities
  elements.json               generated runtime family/variant registry
  scenes/                     scene definitions
  behaviors/                  reusable interactions
  locales/                    six languages (es, en, de, fr, it, pt)
  art/                        source art
  world.php                   world compiler (placements, fares, doors, collisions)
src/adventure-geometry.php    door and interior geometry, used by the compiler
tools/adventure-studio/       local scene composition and non-destructive sprite editor
docs/                         design contract and notes
```

---

## Run locally

```sh
npm ci
npm run dev
# In another terminal:
npm run studio
```

- Game: http://127.0.0.1:47834/aventura
- Studio: http://127.0.0.1:47832
- Tests: `npm test`; Chrome regressions: `npm run test:browser`
- Native activities: `npm run test:native`; API: `npm run test:api:local`
- Separation/protected actions: `npm run test:boundary` (see local guide)
- Review your Studio changes: `npm run studio:diff`

Requires Node 22+, PHP with GD, and Chrome for browser tests.
The game serves its **own static HTML, runtime, locales and art**. The optional
local DDEV website at `https://magikitos.ddev.site` supplies only JSON APIs and
public media. No website templates or bundles are embedded.
`npm run dev:offline` starts without any website connection; Studio is also
independent. `WEB_ORIGIN` may point only to an explicitly local host.
`npm run install:local` mounts a verified immutable build in the local DDEV
website at its six game routes. It never deploys or copies editable engine source.

See [local development](docs/LOCAL-DEVELOPMENT.md),
[Studio](tools/adventure-studio/README.md), and the
[completed repository boundary](docs/REPOSITORY-BOUNDARY.md),
[API contract](docs/API.md) and [OpenAPI](docs/world-api.openapi.json).

The [woodland collection and core review](docs/WOODLAND-KIT.md) documents the
71 new sprites, natural interiors, stable Studio variants and pushable props.

The [local polish review](docs/POLISH-REVIEW.md) records what changed, the
checks actually run and the remaining boundaries. See also the
[original art direction and prompts](docs/art-direction/PROMPTS.md).

The [island and resident library](docs/ISLET-AND-RESIDENTS.md) covers the
100 new NPC profiles, Brizno, open-door editions, Studio families and scene-local
loading. These changes are local; they do not imply a production deployment.

## Contributing

The interesting work is **scenes and dynamics**: new areas, new interactions,
new little puzzles, characters with something to say.

Data, conditions and effects live **outside** the engine — there is no wall of
per-character `if` statements anywhere, and there should never be one. Scenes
and behaviours are declarative and reusable, kept separate from where they are
placed. Sprites ship in independent packs per building, tree, prop and
character, loaded per scene rather than as one giant atlas.

Read `docs/JUEGO-AVENTURA.md` first — it is the design contract, and it is
binding. Then `data/aventura/REFACTOR.md` for the object grammar and
`data/aventura/ART.md` for the art pipeline.

**Language:** code, comments, identifiers and documentation are in English.
Player-facing content is translated across the six locales in
`data/aventura/locales/`; Spanish is the source language for that content.

---

## Notes

- Progress is saved locally under `magikitos.adventure`. The in-game purse is a
  **local test wallet** — it is not connected to any real balance.
- The neighbours you see walking around are an ambient, deferred representation.
  Nobody is online; their walks are computed in your browser.
- Original art, music and characters. Please don't lift the assets.
