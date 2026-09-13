# ✨ Magikitos — The Adventure

A top-down pixel-art adventure set in the world of the Magikitos: warm art,
original characters and music, and not a single reflex test.

> **Status: in development. Not released.** The world runs, but this is an
> active build — expect rough edges, placeholder art and changing data formats.

---

## What the game is

You play a small duende with a pointed hat. You wander, poke at things, pick
up objects, solve little puzzles and pull harmless pranks. That's it, and
that's on purpose.

- **No combat, no death, no timers, no reflex challenges.**
- An open world that grows through interlinked local adventures. Each area has
  its own identity and can open the way to the next through what you do.
- Humour is everyday and cheeky, never at another player's expense.
- Movement is calm. The magic works slowly.

The world is a 128 × 96 tile exterior — a starting clearing, forest, a river
and bridge, a village on grass, a lake and a night campfire corner — plus
separate interiors and a 64 × 48 islet you reach by boat.

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

| | |
|---|---|
| 🐌 **Live unhurried** | They move with absolute patience. Their magic works slowly, building calm or creativity day by day, as an act of resistance against the rush of the modern world. |
| 🎨 **The beauty of the imperfect** | They are not symmetrical or conventionally pretty. Uneven features, crooked smiles, odd details. That imperfection is the point — it is their authenticity, their soul. |
| 💫 **Joy as resistance** | Their presence in a home is an active push against stress, anxiety and bad news; a reminder that calm and joy are necessary, not optional. |
| 🤝 **Community over the individual** | They never act alone. They form a tribe, and they encourage that same sense of community in the home they protect. |

### The 12 Magic Sparks

The most distinctive part of Magikito folklore is their role as carriers of the
**Sparks** — twelve specific energies a Magikito radiates into the home it has
chosen. A person does not pick a Magikito; they are drawn to the Spark they
most need at that point in their life. One Magikito may carry several.

| Spark | What it brings |
|---|---|
| 🧘 **Calm** | Serenity, inner peace, unhurried breathing |
| 🎨 **Creativity** | Inspiration, the flow of ideas, the muse |
| 😄 **Joy** | Laughter, good humour, light on dark days |
| 🛡️ **Protection** | Safety, shelter, healthy boundaries |
| 🗺️ **Adventure** | Exploration, curiosity, nerve for the new |
| 🌿 **Nature** | Connection with the earth and the organic |
| 🏡 **Home** | Belonging, refuge, roots |
| 💝 **Love** | Tenderness, affection, deep connection |
| 🍀 **Fortune** | Good luck, opportunity, fresh starts |
| 📚 **Wisdom** | Perspective, patience, clear sight |
| 👥 **Friendship** | Connection, community, honest bonds |
| 🌙 **Dreams** | Deep rest and the world of dreaming |

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
  scenes/                     scene definitions
  behaviors/                  reusable interactions
  locales/                    six languages (es, en, de, fr, it, pt)
  art/                        source art
  world.php                   world compiler (placements, fares, doors, collisions)
src/adventure-geometry.php    door and interior geometry, used by the compiler
tools/adventure-studio/       local composition studio for scenes and drafts
docs/                         design contract and notes
```

---

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
