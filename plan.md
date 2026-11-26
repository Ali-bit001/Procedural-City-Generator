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
| **B3** | Roofs: flat + parapet, gable, hip, sawtooth, tower crowns, rooftop clutter | ✅ Gable / hip / shed / flat, sawtooth (industrial), tower crowns + rooftop equipment, domes / spires / shikharas (worship) |
| **B4** | Modern core types: office tower, supertall, mid-rise mixed-use, apartment block (the skyline) | 🟨 Mid-rise, office tower, apartments done |
| **B5** | Low-rise types: **row house ✅**, **suburban house ✅**, shop, warehouse, factory | ✅ Done (shops in retail, warehouse + factory in industrial) |
| **B6** | Style system: palettes, realistic/stylized switch, material variation, night mode with lit windows | ⬜ |
| **B7** | Details and LOD: balconies, awnings, signs, fire escapes, LOD0/1/2, merging, instancing | 🟨 Chunks + 2 LODs done |
| **B8** | Stress test: 30×30 grid of random buildings at 60 fps, set the performance budget | ⬜ |
| **B9** | Civic: hospital, clinic, primary / high school, university campus, stadium, train station, bus stand, parking garage, fire station, police station | ✅ Done |
| **B9a** | Places of worship: mosque (domes, minarets, courtyard, ablution area), church (nave, bell tower / spire, stained glass), Hindu temple (shikhara, mandapa), gurdwara (white domes, sarovar pool) | ✅ Done: 13 architectures incl. Buddhist |
| **B9b** | Hotels: business tower, resort slab with pool deck, budget roadside motel; porte-cochère drop-off, lit name sign, flags | ✅ Done |
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
  - stadium (`stadium.ts`, parametric seating bowl in `bowlMesher.ts`), eight designs:
    - classic: four roofed grandstands, corner floodlight masts, scoreboard on an end stand, sponsor banners
    - bowl: continuous rounded-rectangle bowl, 1–2 tiers with a glazed hospitality band, canopy or open
    - round: near-circular / oval bowl
    - horseshoe: open at one end with a scoreboard standing in the gap
    - oculus: huge roof over every seat with an open centre ringed by lights
    - domed: fully covered arena with panel bands and a skylight ring
    - athletics: running track round the pitch, roof over the main side only
    - cricket: oval outfield, low stands, heritage pavilion with a veranda in the open end, sight screens, six floodlight masts
    - all designs:
      - the bowl is a superellipse sized to enclose the pitch or track, then scaled to fit the lot
      - facades are plain, ribbed, glass or banded, with lit entrances
      - LED pitch walls and ad boards
      - a shared entrance plaza with ticket booths, flags and parking
    - the Lab's "stadium design" picker or `?stadium=` chooses one
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
  | stadium | ~18,000–34,000 | ~3,500–4,500 |
  | train station | ~17,000 | ~3,700 |
  | parking garage | ~17,000 | ~4,700 |
  | university | ~49,000 | ~11,000 |

## Done: Places of worship

File: `src/buildings/types/worship.ts`; architectural pieces in `src/buildings/mesher/sacredMesher.ts` (surfaces of revolution).

- **New facade styles:** round arch, pointed arch, rose window and stained glass. Spandrels take the wall colour, and stained glass glows in colour at night.
- **Pieces:**
  - domes: hemisphere, onion, Mughal bulb, fluted gold lotus, lead dome on a windowed drum with a lantern, saucer
  - minarets: Mughal octagonal with balconies and a chhatri, Ottoman pencil, modern needle, neighbourhood with loudspeakers
  - chhatris; church spires (Gothic with pinnacles, pyramid, belfry cupola, onion)
  - nagara shikhara with clustered towers, amalaka and kalash; Dravidian vimana; painted gopuram
  - pagoda, stupa with prayer flags, Nishan Sahib, tent roof
  - buttresses, gravestones, stone lanterns; finials (crescent, cross, Orthodox cross, kalash)
- **Mosque:**
  - Mughal: red-sandstone compound, arcaded cloisters, ablution pool, gateway, pishtaq, three marble domes, four minarets
  - Ottoman: cascading lead domes, domed portico, şadırvan, pencil minarets, small graveyard
  - modern: folded tent hall with needle minarets and reflecting pools, or a cube with a saucer dome
  - neighbourhood: small dome, loudspeaker minaret, water tank, wall
- **Church:**
  - Gothic: nave with aisles and transept, buttresses, stained glass, rose windows; a west spire or twin towers; churchyard
  - colonial: round arches, pyramid or belfry tower
  - modern: A-frame with a free-standing bell tower
  - Orthodox: cross plan with onion domes
- **Hindu temple:**
  - nagara: platform, porch, pyramid-roofed hall, shikhara, saffron flag, corner shrine, flower stalls
  - Dravidian: walled compound, gopuram, vimana, hall, temple tank with a pavilion, flag mast, palms
- **Gurdwara:** white Darbar Sahib with a gold lotus dome and corner chhatris, either in the middle of the sarovar on a causeway or beside it; Nishan Sahib, langar hall, gateway.
- **Buddhist:**
  - pagoda temple: gate, hall, 3–7 tier pagoda, cherry blossom, lanterns, pond and bridge
  - stupa: terraces, prayer flags, ring of chortens, monastery
- **Far LOD:** the pieces switch to fewer segments and drop small details; tiny pieces are skipped.
- **Mosque life:**
  - rows of prayer carpets facing the qibla in the courtyards (Mughal, Ottoman), on the forecourt (modern, neighbourhood)
  - wudu taps along the pool / round the şadırvan, and shoe racks
  - the gurdwara has carpet runners along the parikrama round the sarovar
- **Cost** (near / far): ~0.6k–11k / ~0.4k–6.4k triangles. The Mughal mosque is the heaviest.
- **Lab:** the "places of worship" type with a style picker (or `?worship=` a faith or a style). The neighbourhood mosque, colonial and modern churches and the nagara temple also appear on mixed streets.

## Done: Hotels

File: `src/buildings/types/hotel.ts`.

- **Business:** glazed podium with a porte-cochère over a drop-off loop and taxis, guest tower (14–28 floors) with a lit name sign and sometimes a glass sky bar, flags.
- **Resort:** lobby with a porte-cochère, long slab with a balcony to every room facing a lagoon pool deck (loungers, parasols, pool bar, palms), tennis court.
- **Motel:** two storeys of rooms (door + window each) facing the car park, upper walkway with railings and end stairs, office with a red VACANCY sign, tall roadside sign, fenced pool, ice and vending machines.
- **Landmark designs** (inspired by famous hotel shapes, not copies):
  - sail: a sail-shaped tower tapering to a point, white ribbed facade, exoskeleton legs and braces, cantilevered helipad, spire; reached by a causeway between lagoons with fountain jets
  - sky park: three towers on a podium joined by a sky deck that cantilevers past the last one, with an infinity pool, loungers, parasols and a planted edge
  - arch twin: coral towers with stepped, domed crowns, a bridge suite high between them over a giant gold arch, fountain plaza
  - pyramid: a dark glass pyramid (curtain-wall bands on the sloped faces) with an obelisk and a palm drive
  - cylinders: one to three round glass towers, the tallest with a revolving-restaurant crown and antenna
  - terraced: a ziggurat resort stepping back on both sides, with planted terrace edges and a lagoon deck
- **New props / trees:** lounger, parasol, palm tree, strut, arch rib, obelisk, hedge row, glass pyramid; civic sites can now use polygon (round / tapering) towers.
- **Lab:** the "hotels" type with a style picker (or `?hotel=`); business hotels and motels also appear on mixed streets.

## Done: Vehicles and flying traffic

Files: `src/buildings/mesher/vehicleMesher.ts` (car types), `src/render/helicopters.ts` (fleet). Every parked car used to be the same model. Now there's variety on the ground and a little life in the air.

- **Vehicle types:**
  - sedan, hatchback, SUV, jeep (boxy, spare wheel on the back), pickup (open bed), EV (smooth nose with a light bar and a glass roof), minicar, van / minivan, sports coupe
  - auto-rickshaw, used explicitly by rickshaw stands
  - every car picks a type from its position (weighted towards sedans, hatchbacks and SUVs), so existing car parks, streets and garages vary without changing the generators
  - police cars keep their light bar
  - each type has its own far-view stand-in (~24 triangles)
- **Flying helicopters:**
  - 2–3 helicopters with body, tail boom, tail rotor, skids and a spinning main rotor
  - they fly between the scene's helipads (hospital roofs, tower crowns, the sail hotel) as a state machine: idle on the pad with the rotor spinning up → vertical lift-off → turn towards a random other pad → climb above the skyline → cruise with a nose-down pitch → descend → land → idle
  - with a single helipad they fly loops round the city and come back; with no helipad there are none
  - a few instances updated on the CPU each frame, inside the existing animation layer (30 fps cap, View → animations toggle)
  - View → "🚁 follow helicopter" (or `?follow=1`) gives a chase camera behind one of them
  - tested over 15 simulated minutes per scene: every landing is exactly on a pad, cruising always happens above the skyline, and all pads get visited
- **Later, with the road network:** moving cars, buses and rickshaws on the roads; pedestrians.

## Done: Vehicle details, water towers, power stations and farms

Files: `src/buildings/mesher/vehicleMesher.ts` (doors), `src/buildings/mesher/utilityMesher.ts` (water towers, power and farm kit), `src/buildings/types/power.ts`, `src/buildings/types/farm.ts`; crop fields in `courtMesher.ts`. Lab: "power stations" and "farms" building types with style pickers (`?power=`, `?farm=`).

- **Vehicle details:**
  - door seams and handles on every car type: 4-door, 2-door, the van's sliding door, the pickup cab
  - cab doors and handles on trucks, garbage trucks, fire trucks (plus locker shutters), ambulances (plus rear doors) and buses (folding glass doors)
  - drawn only up close, so they cost nothing far away
- **Water towers (variants of one prop):**
  - pedestal: column and drum (the existing one)
  - classic legged: four to six braced steel legs, a drum with a conical roof, a ladder and a walkway
  - spheroid: a "golf ball" sphere on a slender stem
  - concrete overhead reservoir: a South Asian concrete drum on columns with ring beams
  - fluted chalice: a concrete stem flaring into a wide bowl
  - lattice hyperboloid: a criss-cross steel lattice tower with a tank on top
  - used by utility sites, farms and waterworks
- **Power stations (new "power" building type):**
  - nuclear: hyperboloid cooling towers with big animated steam plumes, reactor containment domes, turbine hall, switchyard with transformers and pylons, security fence
  - coal: boiler house, tall chimneys with smoke, coal stockpiles fed by conveyors, a rail siding with coal wagons, smaller cooling towers, switchyard
  - gas (combined cycle): turbine halls, heat-recovery boilers with slender stacks, fan cooling banks, fuel tanks
  - solar farm: rows of tilted panel tables, inverter cabins, substation
  - wind farm: wind turbines with spinning rotors, control building, substation
- **Farms (new "farms" building type):**
  - fields of striped crop rows: wheat, maize, ploughed furrows, rice paddies, sugarcane
  - crop farm: farmhouse, red barn, silos, tractor, combine harvester, round and square hay bales, centre-pivot irrigation, windpump
  - dairy: cow sheds, cows, feed silos, milking parlour, hay barn, paddocks
  - orchard: rows of fruit trees, packing shed
  - greenhouse farm: rows of glass greenhouses and a packing shed
  - South Asian village farm (dera): mud-brick courtyard house, buffaloes, charpai beds, tubewell with a small pool, conical haystacks, tractor-trolley, wheat / sugarcane / rice fields
  - new animals: cow, buffalo, sheep, goat, chicken
- **Testing and cost:**
  - every power station and farm type passed the headless test (no clashes, animals or vehicles inside buildings, or props off the lot), and each was checked in a screenshot
  - cooling-tower steam uses longer-lived, faster-rising particles so the plumes billow tens of metres
  - cost: nuclear and coal ~32–36k near / ~4k far, gas ~20k / ~3.6k, solar ~23k / ~0.8k, wind ~5k / ~1k; farms ~7–23k near / ~1–9k far (the orchard's trees are the heaviest)
- **Fix found along the way:** the dark coping on flat parapet roofs was drawn as one lid over the whole roof, so every flat roof showed up grey up close. It now caps only the parapet ring, and roofs show their real colour.

## Terrain generation (done)

The first city-layer phase: the land the city will sit on. It is its own page, the Terrain Lab (`terrain.html`), with `src/terrain/` as the module the city layer will later read.

- **Map:** a seeded 4 × 4 km heightmap (513² samples, ~8 m cells), sea level at y = 0.
- **Coastline:** the sea sits on one side, chosen at random. The shore is shaped by warped fractal noise into bays, headlands and a continental shelf, with a gently sloping coastal plain where the city will go.
- **Islands:** 2–5 offshore islands of different sizes, some hilly, each ringed by beach.
- **Mountains:** a range far inland built from ridged multifractal noise (sharp crests, valleys between), with rocky slopes and snow caps above a ragged snowline.
- **Hills and plains:** low rolling fBm in between, fading out towards the coastal plain.
- **Lakes:** 3–5 inland lakes carved as irregular bowls. Each lake's level sits just below its rim so the water is contained, and the lakes have their own shores.
- **Rivers:** 1–2 rivers traced downhill from the mountains (on a depression-filled copy of the map, so they never get stuck) to a lake or the sea. They carve a channel that keeps descending and widens as it goes; the water is drawn as a ribbon.
- **Surface colour (biomes) by height, slope and moisture:**
  - beach sand at the waterline, wet sand just under it, and the seabed darkening with depth (seen through the water)
  - grassland in several tones, darker forest areas, dry scrub
  - rock on steep slopes, snow on the peaks
- **Forests:** instanced trees in clusters wherever the forest mask allows (one draw call per tree type).
- **Rendering for weak GPUs:** terrain in chunks with two detail levels and skirts to hide cracks, flat-shaded low-poly style. The sea is one large plane out to the horizon; lakes and rivers are their own water meshes.
- **Terrain Lab UI:**
  - seed, plus sliders for mountains, islands, lakes, rivers and coast shape
  - a 2D minimap of the generated map
  - orbit / pan / WASD navigation, fly-to on double-click
  - stats (triangles, generation time)
- **For the city layer:** queries for height, slope, water and "buildable" (dry, flat, not forest), so roads and blocks can be laid on it next.

**What was built** (`src/terrain/`: `noise.ts`, `generate.ts`, `mesh.ts`, `main.ts`; page `terrain.html`):

- **Noise:** seeded simplex, plus fBm, ridged multifractal and domain warping.
- **Base field:**
  - A coast field (distance along a random sea direction, warped) gives the shore, a shallow shelf and the deep sea.
  - A gently rising coastal plain with rolling fBm hills sits behind it.
  - A mountain belt further inland uses warped ridged noise inside a slow "massif" envelope.
- **Thermal erosion** (45 passes, talus slope 1.05) turns needle peaks into mountains with scree slopes.
- **Islands:** offshore discs with a warped outline and a hilly profile, kept clear of the map edge.
- **Lakes:**
  - Placed on inland sites with a modest rim, never below sea level (no flooded lagoons).
  - The water level sits just under the rim.
  - The bowl is carved, then a shore rises gently, then an embankment tapers away at a gentle grade (no cliffs on the downhill side).
  - The shoreline polygon follows the warped bowl.
- **Rivers:**
  - Steepest descent on a priority-flood-filled copy of the map, so they never get stuck.
  - They start on high mountain cells and end in the sea, at the map edge or in a lake. A river that reaches a lake's shore flows in and its surface meets the lake flush.
  - Paths are Chaikin-smoothed, and the bed only ever descends. They widen (10 → 44 m) and deepen downstream.
- **Water mask:** per sample, one of dry, sea, lake or river. `waterAt`, `heightAt` (bilinear), `slopeAt` and `buildable` are exported for the city layer.
- **Moisture:** noise, plus water proximity (coast, lakes, rivers). It drives the grass tones, forests and tree density.
- **Trees:** about 7–11k instances in three kinds (broadleaf, conifer at altitude, palm on beaches), one draw call per kind with per-instance tints.
- **Colours:**
  - seabed by depth, wet sand, beach sand on low gentle ground
  - dry / green / lush grass, forest floor, alpine meadow
  - rock by slope and height, snow above a snowline set to 68 % of each map's highest peak
- **Mesh:**
  - 8 × 8 chunks with three detail levels (8 / 32 / 64 m cells), picked by camera distance.
  - Flat-shaded vertex colours.
  - Coarse levels sink their vertices into lakes and rivers so narrow water stays visible.
  - Skirts hide the cracks; they have their own polygon-offset material so their top edges never z-fight.
- **Horizon:**
  - The same base field continues 3 map-widths out as a coarse ring (256 m cells), with the map cut out.
  - Skirts on both sides of the seam, and the map's outer ~200 m is blended into the ring's coarse grid so they meet exactly.
  - The far edge fades into the fog.
- **Water rendering:** a subdivided sea plane plus lake shapes and river ribbons, all Lambert. Specular gave a blown-out Fresnel wash at grazing angles.
- **Terrain Lab:**
  - seed / new seed
  - sliders: mountains, land share, coast roughness, islands, lakes, rivers
  - toggles: water, trees, wireframe; detail distance; sun direction
  - minimap (click to jump), double-click to fly, WASD
  - URL params: `seed`, `cam`, `water=0`, `trees=0`
  - opens from the sea side, looking inland
- **Build:** `vite.config.ts` builds both pages.

**Costs (4 × 4 km map, 513² samples):**

- Generation takes ~1.2–1.6 s and meshing ~0.6 s; both are one-off on a new seed.
- The overview draws ~250–350k triangles; trees are most of it.
- Tested headlessly on 8 seeds and at every slider extreme:
  - 4/4 islands and 4 lakes everywhere
  - 0 leaking lake shores
  - 0 uphill river steps
  - no NaNs

## Terrain v2: a planned region (done)

The user's change: far fewer mountains, a smaller map, and the map laid out around what goes on it.

- **Map:** 3 × 3 km at the same 513² samples, so the cells are 6 m instead of 8 m.
- **Layout (seeded):**
  - **Main city:** a waterfront city on the coast, about 1 km across, with a seeded name (-abad / -pur / -kot / -garh / -nagar).
  - **Two towns:** about 400 m across, 300–1,150 m from the city and apart from each other.
  - **Farmland:** next to one of the towns.
  - **Island district:** offshore in front of the city, with a flat plateau for buildings and a beach ring.
- **Flat building land:** the city and towns are smoothed into gently sloping land (the coastal ramp, ~3 %, with the hills removed). Farmland keeps a quarter of its roll.
- **Highways:** main city → each town.
  - Routed as a gentle curve that keeps off the sea and the mountain.
  - The height profile is a moving average of the ground, max grade ~4–8 %.
  - The ground is cut and filled to the road, blending back over the verges.
  - Drawn as asphalt with edge lines and a dashed yellow centre line.
- **Bridge:** a road-and-rail bridge from the city to the island.
  - It crosses the water at ~7–9 m clearance, with its ends graded into the land.
  - Deck: a road on one side and a ballasted rail track (rails and sleepers) on the other, with parapets.
  - Piers every 36 m, plus a tied arch with hangers and wind braces over the main span (red or white).
- **One mountain**, placed as far from everything as possible and wholly inside the map. If it doesn't fit, it shrinks, and with the mountain slider at 0 there is none.
  - Shape: a warped cone with ridged spurs plus fine rock noise.
  - **Hydraulic erosion** (droplets, ~1 per cell over the mountain) carves gullies and lays fans at the foot; a light thermal pass follows.
  - Shading by curvature: darker, greener gullies and paler ridges. Snow uses the relative snowline, conifers grow up its flanks.
- **Rivers removed** (code, mesh and UI).
- **Lakes and small islands:** placed clear of the sites, roads, bridge line and mountain core.
- **Farm fields:** drawn as crisp draped quads (a staggered field grid with furrow stripes and hedgerow gaps), not painted into the 6 m terrain grid.
  - Hedgerow trees sit along the field edges.
  - No trees in the towns, on the island plateau or within 17 m of a road.
- **Zones:** a per-sample zone mask (city / town / farm / island / road) plus `zoneAt`, `fieldAt`, `sites` and `links` for the city layer.
- **Terrain Lab:**
  - floating site labels (with names; the mountain shows its summit height)
  - site outlines and links on the minimap
  - sliders: mountain (0 = none), land share, coast roughness, small islands, lakes
  - the overview frames the whole region from the sea
- **Costs:** generation ~0.5–0.8 s (it was 1.5 s), about 5–7k trees.
- **Tests:** headless on 10 seeds plus every extreme:
  - always 2 towns, a farm, the bridge and 2 highways
  - no highway point on water
  - the city, towns and island average 4 % slope
  - the bridge ends sit on the ground

## Next
- Building types still open:
  - supertall landmark
  - small street extras: metro entrances, kiosks, billboards, graveyards as their own lots, telecom towers, chai stalls
- Then the building systems:
  - B1: concave and irregular footprints, for the angled lots that real blocks produce
  - B6: realistic style switch
  - B7: third LOD
  - B8: stress test
- Then the city itself, on the terrain: the sites are laid out (main city, two towns, farm, island district), highways and the bridge are in → street networks inside each site → blocks and lots → placing buildings → rail line over the bridge → traffic and pedestrians.
