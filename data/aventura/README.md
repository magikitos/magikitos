# Adventure data and play guide

The normal website stays separate. The game lives at `/aventura`, with translated
entries `/en/adventure`, `/de/abenteuer`, `/fr/aventure`, `/it/avventura` and
`/pt/aventura`. Entry resumes saved progress, never a content query parameter.

For commands, read [local development](../../docs/LOCAL-DEVELOPMENT.md).
The **current game repo preview** is http://127.0.0.1:47834/aventura.
DDEV serves an immutable artifact installed with `npm run install:local`.
Development tools never deploy automatically. See the current approved release
and verification evidence in [Ascua release](../../docs/ASCUA-RELEASE.md).

## Play

Tap/click ground to walk; tap an object to approach and interact. Arrows, WASD
and ZQSD also work. Walking into an interactive object has the same effect.
There is no E key. Diagonal headings have proper directional sprites and
distance-driven footstep animation. Every duende wears a pointed hat.

Hold Space with a direction to run. Double Space (within 320 ms), or a double
click/tap toward a destination, produces one faster forward roll; holding never
repeats it. A tap chooses walking, running or roll→run→walk from route distance,
with no automatic roll into a turn. Drag the map to look around without walking;
walking resumes following the protagonist automatically, and the bottom-right
target button recentres without moving. In a dialogue, Space advances;
Enter and Escape dismiss without activating purchase or other explicit actions.
Most conversations fit a single box. Confirmation says “Ok”.

Walk through open doors to enter/leave. The leaf refuge has a real
upstairs/downstairs connection. Inaccessible houses use closed door art.
Wheel and two-finger pinch zoom the complete world, with no void at scene edges.
Small houses use a restrained cutaway view with a softly defocused woodland outside
the floor, not oversized sprites stretched to fill the screen. That exterior is
non-walkable; doors and stairs keep their original physical thresholds.
The permanent controls are music, “Yo” and the sack.

Macetas and crates can be pushed by walking against them, or by tapping to approach
and push a short distance. Their positions persist per local save. They cannot be
pushed into water, other objects, doorways or scene arrival points.
Closing a contact dialogue suppresses repeated opening until you move away.

## First local adventure

Exploration is free; the protagonist is not blocked by hunger.
Brizno, the seated neighbour by the barbecue, is hungry. Explore north to the
human picnic: the smoking adult has left a lighter beside the blanket, and a
Taramundi pocketknife lies next to the potato tortilla. There is no human house.

Pick the **whole mushroom** near the clearing, without needing a knife first.
Collect a twig by the fallen log. Light the barbecue; use the knife there to
prepare and visibly cook the skewer. The mushroom and twig are consumed; knife
and lighter stay in the sack. Ingredients can be discovered in any order.
The barbecue gives one useful hint for the current state, not a shopping list.

Give the skewer to Brizno. The first reward remains **10 game setines**, independent
of sailing. The picnickers leave permanently when the skewer is cooked.
Every meal starts a **five-real-hour** hunger deadline, persisted across reloads.
When it expires, Brizno becomes hungry again, without bringing the humans back.
Mushrooms and twigs can be collected again; only one uncooked mushroom
or prepared skewer is carried at a time. Later meals do not repeat the first prize.
Uncollected utensils remain obtainable even for existing completed local saves.

The map uses the approved **Cercana** direction: large well-defined trees and
ferns, elf-height wild mushrooms; a boot tavern, stump home, leaf refuge, hollow-log workshop,
and enterable mushroom/pot houses. No human architecture. See [the current woodland kit](../../docs/WOODLAND-KIT.md)
and [the island and resident library](../../docs/ISLET-AND-RESIDENTS.md).

Remo remains at the jetty with a childhood clue, not a fare. Find the plastic
bottle in the northwest picnic bin; bring the reusable knife, two renewable twigs
and two broad leaves to the dock. Build a half-bottle boat with leaf-bladed oars.
Only the bottle/twigs/leaves are consumed. Board, steer with arrows/WASD or the
bottom-right direction pad, or tap water to plot a course. Currents really push
the vessel; use the slower banks to bypass them. No health, damage or lost items.

Five river reaches connect the lake, a side channel to the islet, neighbours'
jetties and your kelihouse. Disembark explicitly near a jetty. The island shell
collector still pays 5 game setines for a shell, repeatably. Neither cooking nor
setines gates sailing. See [river/parcel delivery](../../docs/RIVER-HOMESTEADS.md).

## Content belongs to places

- Stories: the night campfire by the lake, with 6–10 storytellers.
- Jokes: the tavern.
- Street expressions: the special book in the leaf refuge.
- Art: the artists' clearing.
- Shop: the workshop displays, laid out by the browser from public product data.

Other neighbours converse but do not distribute content outside its place.
Their appearances represent public contributors, not people online right now.
Animation and wandering are browser-local; there is no presence polling.

The current B presentation focuses on the activity without a separate page
frame. Escape or a first click outside dismisses it; walking also dismisses it.
Audio continues within its content area, and stops when the area is left.
“Another” preserves existing content pulse selection and exploration.

Activities use the documented JSON API, not website HTML or CSS. The completed
[repository boundary](../../docs/REPOSITORY-BOUNDARY.md) keeps account, recording,
purchase, admin and other full website workflows outside the engine.

## Sack and object rules

Ascua presents new objects overhead before they fly into the sack. The generic
work gesture composes tools and ingredients separately from the character.
Pushing uses a bent-knee effort pose and 42% of normal walking speed.

The fountain accepts one **local** setin when the purse has funds. A visible toss
precedes the atomic debit. Small coins remain in its bowl across reloads, bounded
to twelve visible keepsakes. Extra wishes still cost one; no new quest or account
reward is implied. Cancelling by reloading before commit does not spend money.

Select a held item, choose Use, then select its target. Escape or cancel returns
it to the sack without consuming it. Pickups visibly fly to the sack; reduced
motion uses a concise confirmation.

Scene entities reference reusable behaviors. Conditions, dialogue selection,
effects, one-use items, reusable tools, fares and rewards are data, not branches
inside the movement engine. Effects are planned and validated before committing.
See [rule grammar](REFACTOR.md), [catalogue](catalog.json) and `behaviors/`.

## “Yo”, leaves and real-time needs

Only one need is active: comfortable, pee or poop. Buttons exist only when
appropriate. Pee is sampled 6–10 real hours after the last relief; poop 8–16.
Deadlines are sampled once, survive reload and continue while the browser is
closed. Overdue needs do not stack or expire.

Poop takes precedence when both deadlines have passed and resets both after
completion. Pee resets only its own deadline. There are no penalties or forced
accidents.

Broad-leaf plants in the forest and island supply cleaning leaves, stackable to 99. Pooping requires and consumes one leaf when its animation finishes; peeing
does not. Reloading midway commits neither consumption nor new deadlines.
The temporary trace is private to the local game: poop lasts 24 hours, puddles
5 minutes, with at most 48 saved traces. They have no collision or DB events.

## Persistence and ownership

`magikitos.adventure` in localStorage holds scene, position, entrance, flags,
inventory, local purse, audio preference, deadlines, movable objects, fountain
keepsakes and temporary traces.
The six languages share the same origin and storage key.
Writes are batched when state changes, on interaction, and when leaving.

Invalid positions fall back to the safe spawn for that scene while retaining
valid progress. Storage failure is visible in the sack. Use an isolated browser
profile to test from scratch, not deletion of the user's data.

Device identity follows the site's existing identifier. It is not authentication
or an authority to alter an account. Account creation uses the existing explicit,
controlled identity action; opening “Yo” alone mints nothing.

Progress and the game purse synchronize through the private website API when
connected to its identity. The real website reputation balance/ledger stay
untouched. No movement/event collection. See [save protocol](../../docs/GAME-SAVE-API.md).

At your plot, edit one garden and one natural interior. Place registered objects,
drag, change variants or put them away. There are no named drafts or publish
buttons: saving your layout makes its snapshot public. Visitors cannot move or
take furniture. Paths, access and shorelines stay protected. The river continues
to work and visits return to the original neighbour jetty.

## Scene and art contract

Scene coordinates and physical bodies are in tiles; native pixels use TILE=16.
Rendering, picking, exact transformed bodies and movement use a shared geometry.
A spatial index bounds collision work; architectural walls and solid vegetation
use the same precise body system as furniture. Navigation stays conservative
and physical substeps validate the actual route. A* also checks live residents
and the complete foot envelope along edges, not just terrain or occupied cells.
Click journeys keep an explicit ground/interact/portal/push intention; incidental
contacts reroute without executing reactions. See [navigation](../../docs/NAVIGATION.md).

Source scenes, behavior modules, asset definitions and locales stay independent.
The Studio's one working version is not the game source. It exports reviewed
diffs and retains a private recovery history; it has no live apply/deploy endpoint.
Read [Studio](../../tools/adventure-studio/README.md) and [art](ART.md).
