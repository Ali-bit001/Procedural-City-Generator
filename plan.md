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
| **Office tower** | Podium plus box, rounded or chamfered tower | Curtain wall or grid | Flat roof, mechanical housing, antenna | floors 20–60, corner style |
| **Mid-rise mixed-use** | Built to the lot edge, occasional upper setback | Shopfront ground floor, punched windows above | Parapet, AC units, water tank | floors 4–12, brick or modern |
| **Apartment block** | Slab, point tower or courtyard | Punched windows, balconies | Flat roof, roof garden | floors 5–25, balcony style |
| **Row house/townhouse** ✅ | Narrow joined boxes | Bay windows, stoops | Gable or flat roof, chimneys | width, colours, roof height variation |
| **Suburban house** ✅ | Main block + wing + garage, or stacked volumes | Windows, door, porch | Gable, hip, shed or flat roof | style, floors, garage, wing, porch, pool |
| **Shop/strip mall** | Wide, low box | Glass front, signs | Flat roof, big AC units | number of units, sign colours |
| **Warehouse** | Large low box | Few windows, roll-up doors | Sawtooth or flat roof, loading docks | size, number of docks |
| **Factory** | Mixed boxes | Industrial cladding | Smokestacks, tanks, pipes | number of stacks, tanks |
| **Civic** (hospital, school, stadium, station, parking garage) | One template each | Type-specific | Type-specific | template parameters |

---

## Part 5: Phases

| Phase | Content | Status |
|---|---|---|
| **B0** | Building Lab setup: Vite + Three.js, OrbitControls, GUI (seed, count, style, sun), hover info, click to focus, seed in URL | ✅ Done |
| **B1** | Massing core: polygon extrusion, insets, setbacks, taper, twist, podium + tower, courtyard | ⬜ |
| **B2** | Floors and facade grammar, window shader (UV cells, frames, glass), special ground floor | ⬜ |
| **B3** | Roofs: flat + parapet, gable, hip, sawtooth, tower crowns, rooftop clutter | ⬜ (gable/hip/shed/flat done for houses) |
| **B4** | Modern core types: office tower, supertall, mid-rise mixed-use, apartment block (the skyline) | ⬜ |
| **B5** | Low-rise types: **row house ✅**, **suburban house ✅**, shop, warehouse, factory | 🟨 In progress |
| **B6** | Style system: palettes, realistic/stylized switch, material variation, night mode with lit windows | ⬜ |
| **B7** | Details and LOD: balconies, awnings, signs, fire escapes, LOD0/1/2, merging, instancing | ⬜ |
| **B8** | Stress test: 30×30 grid of random buildings at 60 fps, set the performance budget | ⬜ |
| **B9** | Civic templates: hospital, school, stadium, station, parking garage | ⬜ |
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

## Next
Waiting on feedback for the suburban house, then the next building type.

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
