# Buildings Plan

Buildings are built in a standalone **Building Lab** first: one page where buildings are generated, settings are tweaked live and the seed can be changed. Buildings don't depend on roads or blocks. Each generator takes a **footprint polygon plus parameters** and returns a building. The city can then be designed later without throwing any of this work away.

---

## Part 1: Decisions (agreed)

| # | Decision | Choice |
|---|---|---|
| 1 | **Visual style** | A style switch: the same shapes with different material sets. Start **stylized** (flat colours, clean shapes), add realistic later. |
| 2 | **Facade detail** | **Shader windows by default** (cheap, scales to thousands of buildings), **real geometry for nearby buildings** via LOD. Small buildings such as houses use real window geometry because they are cheap. |
| 3 | **How buildings are generated** | **A light grammar:** templates for the overall shape, grammar rules for facades (`Facade → Floors → Bays → Window/Door`). |
| 4 | **Variety vs. coherence** | **District style palettes** with random variation inside each. |
| 5 | **Architectural era** | **Mixed, weighted toward modern** (modern towers plus older brick mid-rise and classic houses). |
| 6 | **Footprint shapes** | **Any polygon from day one.** Real lots won't be rectangles. |
| 7 | **Interiors** | **None at first**, interior-mapping shader as a later polish. |

---

## Part 2: Architecture

```
BuildingSpec (input)           →  Generator   →  BuildingModel (data)   →  Mesher  →  Three.js meshes
- footprint polygon                (per type)      - massing volumes           (LOD 0/1/2)
- type, zone, density                              - facade descriptions
- floors / height                                  - roof elements
- style palette                                    - detail items (AC, signs, balconies)
- seed
```

- **Generators** never touch Three.js. They only produce data, which makes them easy to test and lets them run in a Web Worker later.
- **The mesher** reads the data and builds geometry for each detail level:
  - LOD0: full detail, nearby
  - LOD1: boxes with shader facades
  - LOD2: one merged box, far away
- **Style palettes** are plain data (colours, glass tint, roughness, window ratio, roof types), so the look can be adjusted without touching code.
- Geometry is merged per building into a few vertex-coloured buckets (solid / glass / water), so one building is about 3 draw calls.

```
src/
  core/                rng.ts (seeded), color.ts
  buildings/
    spec.ts            BuildingSpec / BuildingModel types
    massing/           extrude, setback, taper, twist, podium+tower, courtyard, L/U shapes
    facade/            floor/bay grammar, window patterns, ground floor, balconies
    roof/              flat+parapet, pitched, hip, gable, sawtooth, crowns, rooftop clutter
    types/             house.ts, skyscraper.ts, office.ts, mixedUse.ts, apartment.ts,
                       rowhouse.ts, warehouse.ts, factory.ts, civic/*.ts
    styles/            palettes.ts, materials.ts
    mesher/            MeshBuilder.ts, per-type meshers, LOD, merge/instancing
    shaders/           window shader, night lights, (later) interior mapping
  lab/                 Building Lab page (street of examples + GUI)
```

---

## Part 3: The generation pipeline for every building

1. **Footprint:** clean the polygon, inset it by the setback, and find its main axis (oriented bounding box) so facades line up with the street.
2. **Massing:** stack volumes: podium, then body, then setbacks or taper, then crown. Each volume is an extruded polygon with a floor range.
3. **Floors:** split each volume into floors. The ground floor is taller and the mechanical top floor is different.
4. **Facades:** split each wall into **floors × bays**, then give each bay a window pattern: ribbon, punched, curtain wall or grid. The street-facing wall gets entrances and shopfronts. Bays hidden behind another volume are skipped.
5. **Roof:** pick the roof type by building type, then scatter rooftop items (AC units, water tanks, stair housings, antennas, helipads, gardens) without overlaps.
6. **Details:** balconies, awnings, signs, fire escapes, chimneys and loading docks, all as instanced parts.
7. **Materials:** from the district style palette, plus small random shifts in hue and wear.

---

## Part 4: Building types

| Type | Massing | Facade | Roof/details | Key parameters |
|---|---|---|---|---|
| **Supertall/landmark** | Podium, tower, several setbacks, taper/twist | Curtain-wall glass | Spire, lit crown | height 250–500 m, taper, twist, number of setbacks |
| **Office tower** ✅ | Podium plus box, rounded or chamfered tower | Curtain wall or grid | Flat roof, mechanical housing, antenna | floors 20–60, corner style |
| **Mid-rise mixed-use** ✅ | Built to the lot edge, occasional upper setback | Shopfront ground floor, punched windows above | Parapet, AC units, water tank | floors 4–12, brick or modern |
| **Apartment block** ✅ | Slab, point tower or courtyard | Punched windows, balconies | Flat roof, roof garden | floors 5–25, balcony style |
| **Row house/townhouse** ✅ | Narrow joined boxes | Bay windows, stoops | Gable or flat roof, chimneys | width, colours, roof height variation |
| **Suburban house** ✅ | Main block + wing + garage, or stacked volumes | Windows, door, porch | Gable, hip, shed or flat roof | style, floors, garage, wing, porch, pool |
| **Shop/strip mall** ✅ | Wide, low box | Glass front, signs | Flat roof, big AC units | number of units, sign colours |
| **Warehouse** | Large low box | Few windows, roll-up doors | Sawtooth or flat roof, loading docks | size, number of docks |
| **Factory** | Mixed boxes | Industrial cladding | Smokestacks, tanks, pipes | number of stacks, tanks |
| **Civic** (hospital, school, stadium, station, parking garage) | One template each | Type-specific | Type-specific | template parameters |
| **Places of worship** (mosque, church, temple, gurdwara) | Prayer hall + courtyard / nave + tower | Arched windows, carved screens, stained glass | Domes, minarets, spires, bell towers, shikhara | dome count, minaret count, courtyard, style |
| **Hotel** | Tower or slab on a podium | Repetitive room windows, glazed lobby | Pool deck, lit name sign, rooftop bar | stars, height, porte-cochère, pool |
| **Industrial** (warehouse, factory) | Big sheds, sawtooth / flat roofs, annexes | Ribbed metal cladding, high strip windows, dock doors | Smokestacks, tanks, silos, pipe racks, conveyors, cranes | size, process type, stack count |

---

## Part 5: Phases

| Phase | Content | Status |
|---|---|---|
| **B0** | Building Lab setup: Vite + Three.js, OrbitControls, GUI (seed, count, style, sun), hover info, click to focus, seed in URL, WASD / Q-E movement, ground panning, zoom to cursor, street view | ✅ Done |
| **B1** | Massing core: polygon extrusion, insets, setbacks, taper, twist, podium + tower, courtyard | 🟨 Convex polygon towers: setbacks, taper, twist |
| **B2** | Floors and facade grammar, window shader (UV cells, frames, glass), special ground floor | ✅ Done (window shader) |
| **B3** | Roofs: flat + parapet, gable, hip, sawtooth, tower crowns, rooftop clutter | ⬜ (gable/hip/shed/flat done for houses) |
| **B4** | Modern core types: office tower, supertall, mid-rise mixed-use, apartment block (the skyline) | 🟨 Mid-rise, office tower, apartments done |
| **B5** | Low-rise types: **row house ✅**, **suburban house ✅**, shop, warehouse, factory | 🟨 In progress |
| **B6** | Style system: palettes, realistic/stylized switch, material variation, night mode with lit windows | ⬜ |
| **B7** | Details and LOD: balconies, awnings, signs, fire escapes, LOD0/1/2, merging, instancing | 🟨 Chunks + 2 LODs done |
| **B8** | Stress test: 30×30 grid of random buildings at 60 fps, set the performance budget | ⬜ |
| **B9** | Civic: hospital, clinic, primary / high school, university campus, stadium, train station, bus stand, parking garage, fire station, police station | ✅ Done |
| **B9a** | Places of worship: mosque (domes, minarets, courtyard, ablution area), church (nave, bell tower / spire, stained glass), Hindu temple (shikhara, mandapa), gurdwara (white domes, sarovar pool) | ⬜ |
| **B9b** | Hotels: business tower, resort slab with pool deck, budget roadside motel; porte-cochère drop-off, lit name sign, flags | ⬜ |
| **B9c** | Street & public extras (small structures, placed by the city layer): parks (paths, lawns, trees, ponds, playgrounds, gazebos, fountains), plazas, bus stands / shelters, metro entrances, taxi / rickshaw stands, kiosks & newsstands, public toilets, phone / EV charging points, garbage collection points and municipal dumps (skips, compactor trucks, landfill mounds), recycling centres, electrical substations, water towers, telecom towers, police / fire posts, petrol pumps along highways, traffic police booths, roadside chai stalls / dhabas, billboards, graveyards | 🟨 Parks, bus stands, garbage points, waste yard, substations, water towers done |
| **B9d** | Industrial: warehouses / logistics, factories (smokestacks, tanks, silos, pipe racks, conveyors, gantry cranes) with animated smoke, fans, cranes and conveyors | ✅ Done |
| **B10** | City integration (after roads and blocks exist): lots feed `BuildingSpec`s into the same generators | ⬜ |

Types are built **one at a time**, each reviewed in the Lab before moving on.

---

## Done: Suburban house grammar

File: `src/buildings/types/house.ts` (data), `src/buildings/mesher/houseMesher.ts` (geometry).

```
Lot      -> Setbacks + House + Driveway + Paths + Yard
House    -> Main mass [+ Wing (L-shape)] [+ Garage] [+ Upper volume (modern)]
Mass     -> Floors x Walls -> Bays -> Window | Door | GarageDoor
Mass     -> Roof (gable | hip | shed | flat) [+ attic window] [+ chimney]
Entrance -> Porch (posts + shed roof) | Canopy (modern)
Yard     -> Lawn + Fence/Hedge + Trees + Shrubs [+ Pool]
```

- **Styles:**
  - **Traditional:** 1–2 floors, steep gable/hip, shutters, porch, chimney.
  - **Ranch:** 1 floor, long and low, shallow roof.
  - **Modern:** flat/shed roofs, large windows, contrasting cantilevered upper volume, canopy.
- **Openings:** bays per wall and floor. Windows hidden by other volumes are skipped. The most central ground-floor front bay becomes the door. Gable attic windows, garage roll-up doors.
- **Yard:** driveway with apron to the street, front path (sometimes turning to the driveway), fence/hedge around the backyard, trees placed without overlaps, foundation shrubs, optional pool, street tree.
- **Lab:** 20 houses (adjustable) on a street, numbered labels, hover tooltip, click to focus.
- **Checked:** 500 houses generated headless with no broken geometry, every house has a door, about 2.8k triangles per house.


## Done: Row houses / townhouses

File: `src/buildings/types/rowhouse.ts`.

```
Lot   -> Row of N units sharing party walls
Unit  -> Mass [+ Bay window] [+ Recessed top floor] [+ Garage door]
Front -> Bays x Floors -> Window | Door (doors mirrored in pairs)
Entry -> Stoop + railings | Door hood + steps | Canopy
Yard  -> Paved areaway + iron fence | front garden | driveway; narrow fenced back yards
```

- **Brownstone:** 3–5 floors, varying heights, raised parlour floor with a stoop and iron railings, cornices, garden-level windows, iron front fence.
- **Terrace:** pastel units, continuous slate gable or a front gable per unit, chimney stacks on party walls, door hoods.
- **Modern townhouse:** mixed cladding, flat roofs, optional recessed top floor with roof terrace, optional integrated garages.

## Done: Small-details system (shared by all residential types)

File: `src/buildings/details/details.ts` (placement), `src/buildings/mesher/propMesher.ts` (geometry).

- **Yard:** swing set, slide, trampoline, dog house, patio set with umbrella, BBQ, garden bed, clothesline, bench.
- **Services:** water tanks (on flat roofs on a short stand, or on a tall steel stand in the yard), wall-mounted split ACs, ground AC units, solar panels, satellite dishes.
- **Street side:** parked cars, mailboxes, bins.
- **Lights:** door sconces, porch ceiling lights, garage lights, back-door lights, path bollards, lamp posts, street lamps.
- **Night mode:** lamps and some windows glow, with bloom.
- **Lab sliders:** water tank frequency, yard prop density, parked car chance.

## Done: Mid-rise mixed-use

File: `src/buildings/types/midrise.ts`.

```
Lot      -> Building at the sidewalk + paved service yard behind
Building -> Ground floor (retail) + Upper block [+ recessed top floor] + Roof room
Ground   -> Lobby door + Shops (shopfront | roller shutter) + Signs [+ awnings]
Upper    -> Floors x Bays -> Window | Balcony door + Balcony (+ sunshades, split ACs)
Roof     -> Parapet + stair room + water tanks / water tower / AC units / solar / clotheslines
```

- **South Asian plaza:** upper floors projecting over the shops, slab bands, chajjas, iron or solid balconies, roller shutters, big glowing signboards, many tanks (also on the stair room), split ACs on every side, rooftop clotheslines.
- **Main street:** brick, cornice, string courses, Georgian windows, shopfront fascia signs, striped awnings, wooden rooftop water tower.
- **Modern:** ribbon windows or full curtain wall, glass balconies, recessed top floor, rooftop AC units and solar.

## Done: Rendering optimisation (applies to every building type)

Files: `src/render/windowMaterial.ts`, `src/render/materials.ts`, `src/render/chunks.ts`, `src/buildings/mesher/lotMesher.ts`.

- **Facade shader:** every window, door, garage door, shopfront, roller shutter, sign and glass railing is one quad. Frames, mullions, glass reflections, curtains and night glow are painted in the shader.
- **Cut-out quads:** picket fences and iron railings are single see-through quads; their shadows keep the gaps.
- **6 materials, merged per chunk:** solid, window, cutout, glass, water, lamp. Lots are merged into 64 m chunks, about 6 draw calls per chunk.
- **2 LODs per chunk:** the far level drops props, frames, railings and fixtures but keeps silhouettes, facades, trees, water tanks and glowing lamp heads.
- **Hidden faces skipped:** box faces against walls, the ground or roofs are never emitted.
- **Cheap picking:** per-lot bounding boxes, no triangle raycasts.
- **Static shadows, on-demand rendering, quality presets.**

| Lot type | Before | LOD 0 (near) | LOD 1 (far) |
|---|---|---|---|
| Suburban house | ~4,600 tris | ~2,000 | ~550 |
| Row houses (6–7 units) | ~17,500 | ~7,000 | ~1,900 |
| Mid-rise | — | ~3,200 | ~1,400 |

A 60-lot street (~1 km): 122 draw calls, ~105k triangles drawn, generated and meshed in ~0.3 s.

**Budget left for the pseudo-simulation:** pedestrians and cars should be `InstancedMesh` (one draw call per model type), moved on the CPU along sidewalk / lane paths, with only nearby instances animated.

## Done: Office tower

File: `src/buildings/types/tower.ts` (generator), `polyMassMesh` in `src/buildings/mesher/lotMesher.ts` (geometry).

```
Lot     -> Plaza (trees, benches, fountain, bollards) + [Podium] + Tower + service yard
Tower   -> Footprint (rect | chamfered | rounded | round) x Modifier (none | setbacks | taper | twist)
Segment -> extruded convex polygon; facade = one shader quad per edge per floor
Crown   -> plant room + AC units | helipad | spire   [+ lit crown band]
```

- **Towers are `PolyMass`es:** convex extruded polygons, so they can be rotated (twist), scaled (taper) and stepped (setbacks). This is the massing core the supertall and apartment towers will reuse.
- **Facades:** glass curtain wall (the frame colour tints the glass) or stone grid with punched windows (new `grid` shader style).
- **Night:** offices light up floor by floor, with cool fluorescent light that varies pane by pane.
- **Designs** (`design` in the Lab, `?design=` in the URL):
  - **classic:** straight, setbacks, taper or a gentle twist
  - **spiral:** 120–220° twist, slimming as it rises
  - **flame:** swells above the base and narrows to a point, gentle twist, spire
  - **stacked:** blocks of 4–8 floors shifted and turned like a pile of boxes
  - **rotating:** every floor plate turned to its own angle around a round core, with a gap under each plate (inspired by the Dynamic Tower concept)
  - **yTower:** three wings around a hexagonal core, stepping back in a spiral, core rising into a tall spire
- **Footprints:** rect, chamfer, rounded, round, oval, triangle, hexagon, octagon, diamond. Y-towers are composites of convex wings.
- **How designs work:** each is a function "floor index -> convex polygons". Runs of identical floors merge into one volume, and the finished tower is shrunk about its axis if any floor would leave the lot.
- **Rooftop equipment** (placed inside the roof outline, clear of the plant room / helipad / spire and of each other): AC condensers or cooling towers, lattice telecom masts with sector antennas and microwave dishes, antenna clusters, large satellite dishes, window-cleaning cranes (BMU) reaching over the edge, flagpoles, lit rooftop signs, and red aviation obstruction lights on the corners of every tower over 60 m. South Asian mid-rises sometimes carry a telecom mast, and main-street blocks an antenna cluster.
- **Cost** (near / far): classic ~2,600 / ~1,100, stacked ~2,400 / ~900, Y-tower ~3,600 / ~1,700, spiral ~3,800 / ~2,200, flame ~4,400 / ~2,400, rotating ~5,800 / ~3,400. Heights range 57–301 m.

## Done: Apartment blocks

File: `src/buildings/types/apartment.ts`.

```
Lot       -> Form + site (lawns, paths, parking, playground, trees, lamps)
Form      -> slab | point tower | L-block | courtyard (perimeter block, optional gateway arch)
Facade    -> Floors x Bays -> Window | Entrance door (+ canopy) | Balcony door + Balcony
Balconies -> pattern (stacked columns | checkerboard | ends | all) x kind (loggia | glass | iron | French)
Life      -> split ACs, satellite dishes, laundry on balconies, rooftop tanks / antennas / solar
```

- **Panel:** prefab blocks, loggias painted in mixed pastels per column, floor-joint bands, many wall ACs and dishes, rooftop antennas.
- **Modern:** large windows, staggered glass balconies, rooftop AC units and solar.
- **South Asian:** painted plaster, sunshades over every window, iron balconies with laundry, split ACs everywhere, lots of rooftop water tanks, occasional telecom mast.
- **Brick:** French balconies, white windows, iron front railings, pitched roofs on half of them (wings overlap so the ridges meet cleanly).
- **Courtyard blocks** fill the lot around a private garden with a playground; half get a gateway arch through the front wing.
- **Services on the walls:**
  - **Pipes:** drainpipes / plumbing stacks from ground to roof with brackets, a shoe and a gooseneck. South Asian blocks get several stacks with a branch into the wall at every floor; panel and brick get corner downpipes.
  - **Fire escapes:** steel platforms per floor, zig-zag flights, cut-out railings and a drop ladder, on end walls of brick / panel / South Asian blocks. Some main-street mid-rises get a New York style one across two front bays.
  - **Lift shafts** (glazed, floor by floor) and **stair towers** (slit windows at the half-landings) attached to the outside, rising one floor above the roof.
  - Placement never collides: shafts are masses, so windows behind them are never placed and balconies avoid them; pipes and fire escapes are blockers that ACs and dishes stay out of.
- **Cost:** ~9,500 triangles near / ~4,400 far for a whole block (dozens of flats).

## Next
## Done: Retail

File: `src/buildings/types/retail.ts`.

- **Strip mall:** single-storey row of shops behind a covered walkway (`arcade` porch), marked parking with lot lights, pylon sign, loading doors and dumpsters on a service lane, rooftop AC units.
- **Big-box store:** large box with a brand stripe, a taller glazed entrance block with the main sign, a second giant sign, loading docks with trucks backed in, rooftop units and skylights, a huge lot with trolley shelters.
- **Petrol station:** fuel canopy (lit underneath, brand band glows at night) over pump islands with squeegee buckets, convenience store, price pylon, cars at the pumps. Extras: a drive-through car wash bay (lit sign, spinning brushes, sometimes a car inside), tyre air / water post, vacuum stations, EV chargers, puncture-repair tyre stacks, and an ice chest / gas-cylinder cage / vending machine along the shop front.
- **Bazaar:** South Asian market row of narrow 2–3 storey shops in different colours, half-open roller shutters, stacked lit signboards, striped awnings, fruit stalls on the pavement; sunshades, iron balconies, ACs and tanks above.
- **Car showroom:** tall glazed showroom with a brand cornice, service bays behind, a display forecourt with rows of angled cars, a hero car on a lit platform, pennant strings along the street and a pylon sign.
- **Shop types** (`src/buildings/details/shops.ts`): every shopfront in strip malls, bazaars and mid-rise ground floors is a specific shop with its own signs, awning habits and frontage. Western and South Asian streets use different mixes.
  - café / restaurant: tables and chairs, umbrellas when not under a roof, menu boards, planters, festoon string lights
  - grocery: tiered produce crates (and a fruit stall on deep South Asian pavements); florist: flower stands
  - pharmacy: glowing green cross; barber: barber pole; bank: ATM in the wall
  - bakery: menu board and bench; clothing: clothes rails (South Asia); hardware: goods stacked outside
  - mobile shop: bright signs; tea stall: plastic tables and chairs; motorbike shop: motorbikes lined up
  - South Asian streets also get parked motorbikes in front of other shops
- **Reusable new pieces:** `ParkingLot` (asphalt + stall lines, cars parked nose-in), arcade porch, pylon signs, fuel canopy / pumps, trolley shelters, dumpsters, trucks, market stalls, parking-lot light poles.
- **Cost** (near / far): strip mall ~7,600 / ~500 (mostly parked cars), big box ~2,600 / ~1,200, petrol station ~1,800 / ~400, bazaar ~5,400 / ~2,900.

## Done: Industrial

File: `src/buildings/types/industrial.ts`; animation in `src/render/animation.ts`.

- **Warehouse:** ribbed metal cladding (new `cladding` / `claddingStrip` shader styles), flat or sawtooth roof with north lights, loading docks with a canopy and trucks, glazed office annex, container stacks (sometimes under a gantry crane), rooftop and wall exhaust fans.
- **Factory:** metal-clad or old brick sawtooth hall, boiler house, 1–3 smokestacks with aviation lights, tank farm in a bund with a pipe rack, silos fed by conveyors, rooftop cooling towers, crane yard, sometimes a wind turbine.
- **Both:** security fence with gate and gatehouse, floodlights, forklifts, pallets, drums.
- **GPU animation layer:** smoke and steam particles (billboards, wind drift, darker at night), spinning fans / turbine rotors / car-wash brushes, sliding gantry cranes and conveyor crates. All motion is computed in the vertex shader from one time uniform; one draw call per kind for the whole city. View → animations toggles it; animation-only frames are capped at 30 fps.
- **Cost** (near / far): warehouse ~5,200 / ~2,600, factory ~5,000 / ~2,100, plus the animated layer.

## Done: Civic

Files: `src/buildings/types/civic/` (`site.ts` toolkit, `grounds.ts` landscape toolkit, `health.ts`, `education.ts`, `public.ts`, `parks.ts`, `landscape.ts`); sports surfaces in `src/buildings/mesher/courtMesher.ts`; walks, lakes and plazas in `src/buildings/mesher/groundMesher.ts`.

- **Linked paths** (`Site.linkPaths`): every door and extra target (courts, stands) is joined to the nearest path, drive, car park or the street by the shortest clear route: L-shaped, or round buildings via their edges. Used by the hospital, schools and university, so the buildings read as one campus.
- **Shared site toolkit:** one `Site` per lot collects masses, windows, doors (which clear the windows they overlap), signs, parking, courts, fences with gates, flags, path furniture and trees, and emits a `HouseModel`. Each form has a recommended lot size (`CIVIC_LOTS`) and a frequency weight.
- **Health:**
  - hospital: tall ward block with a big red cross and rooftop helipad, glazed lobby with a drop-off canopy and loop, side and back wings, emergency department (canopy, red sign, ambulances, own drive), parking, flags
  - clinic: 1–2 storeys, glass entrance under a canopy, lit green cross, a few stalls, sometimes an ambulance
- **Education:**
  - primary school: low L-block in bright colours, playground (climbing frame, swings, seesaw, slide on a soft surface), small pitch or court, school bus bay, bike rack, fence
  - high school: 3-storey U-block around a courtyard, gym hall, running track around a football field with bleachers and floodlights, basketball or tennis court, buses, staff parking
  - university campus: admin hall with a clock tower, quad with cross paths, fountain and benches, lecture halls, library with a portico, dorm slabs, courts, parking, campus bus, stadium-style sports ground
- **Public:**
  - stadium: pitch inside four roofed grandstands, floodlight masts, ticket booths, plaza, flags, parking; lit LED advertising boards round the pitch, sponsor banners on the backs of the stands, video scoreboard on an end stand
  - train station: glazed concourse and wings, taxi rank, platforms with long canopies, tracks, trains, enclosed footbridge
  - bus stand: terminal hall, sheltered island platforms, buses in the bays, rickshaws and taxis
  - parking garage: 3–6 open decks with cars on every level, a two-lane scissor-ramp tower beside the decks (ramps alternate lanes and directions between landings at each end, so they never intersect), stair core, "P" signs
  - fire station: bay doors, trucks on the apron, crew quarters, drill tower
  - police station: blue sign, patrol cars with light bars, fenced yard
- **Parks and services:**
  - park (`landscape.ts`), laid out probabilistically:
    - a style (formal, natural or sporty) sets path curvature, lake odds, tree density and the feature mix
    - gates on the street side, sometimes on the sides and back; often a blobby lake
    - 3–9 features placed by rejection sampling: fountain plaza (animated water spray), playground, gazebo with picnic tables, basketball or tennis court, statue, flower garden, toilets and kiosk, small pond; plus junctions with a shade tree
    - walks join everything on a visibility graph (waypoints round obstacles and the lake). Each feature links by its shortest route, plus a few loops. Single hops bow gently, and multi-hop routes are smoothed
    - walks over the lake become arched footbridges
    - lamps and benches face the walks; formal parks get tree avenues; elsewhere trees grow in Gaussian clumps
  - zoo (`landscape.ts`):
    - street forecourt with a ticket office, gift shop, entrance arch, flags, car park and bus
    - inside a fenced ground: a hub fountain and a flamingo lake with a bridge
    - enclosures: savanna (giraffes, zebras, antelope), elephants, big cats, bears, hippos (sitting in the pool), rhinos, penguins and antelope. Each has its own ground, fence height, pool, rocks, trees and sometimes a keeper house, plus a viewing point facing the hub
    - reptile house, cafe with tables, toilets and an aviary dome, all on the same curving walk network
    - 10 low-poly animal species (`animal` prop)
  - waste yard: landfill mounds with a bulldozer, transfer shed, weighbridge and gatehouse, skips, recycling dumpsters, garbage trucks
  - collection point: walled pad with dumpsters and bag piles
  - utility: substation (transformers, control house, pylons) and / or a water tower with a pump house
- **Sports surfaces:** football, cricket, basketball, tennis, running track, playground; line markings only up close.
- **Far LOD:** big structures (stands, floodlights, decks, canopies, towers) stay; rails, pylons and transformers get cheap stand-ins.
- **Cost** (near / far):

  | Form | Near | Far |
  |---|---|---|
  | clinic | ~2,100 | ~540 |
  | primary school | ~4,600 | ~850 |
  | fire station | ~3,300 | ~630 |
  | police station | ~4,900 | ~820 |
  | park | ~9,200 | ~3,100 |
  | zoo | ~36,000 | ~8,000 |
  | hospital | ~16,000 | ~3,600 |
  | high school | ~15,800 | ~2,800 |
  | stadium | ~17,500 | ~3,900 |
  | train station | ~17,000 | ~3,700 |
  | parking garage | ~17,000 | ~4,700 |
  | university | ~49,000 | ~11,000 |

## Next
Waiting on feedback, then places of worship and hotels.
