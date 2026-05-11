# Project Memory

## Goal
- Build a WeChat mini program for travel planning.
- Target users are young travelers who care about real experience over ad-heavy recommendations.
- Core output is a clear, executable, day-by-day route plan.

## Current Product State
- Modes are `relaxed` and `hardcore`.
- Main cities are `Suzhou`, `Jingdezhen`, and `Sanya`.
- `Hainan` is no longer a top-level entry on the home page.
- The old home recommendation block was removed.
- Route pages already rely on map data and marker filtering.

## Home Page Decisions
- A discovery preview module sits between the city picker and `Build Route`.
- Discovery preview images now use local static assets under `assets/discovery-previews/`.
- The preview interaction is currently moving toward an Apple Watch-like selection style.
- Only the center item should show text.
- Address text should not be shown under the preview icon.
- Edge items should behave as supporting bubbles, not equal cards.

## Content / Routing Logic
- Content should be collected, filtered, and stored locally first.
- Social platforms such as Xiaohongshu are for assisted collection, not live runtime dependency.
- Hotel recommendations should stay in the mid/high quality range.
- Food planning should distinguish `main meal` from `snack/drink`.
- Duplicate meals across days should be avoided.
- Map markers must stay region-correct and confidence-checked.

## City Notes
- `Suzhou`: continue focusing on old town, Jinji Lake, and Taihu/Xishan.
- `Suzhou` should keep real food, cafe, hotel, and route-linked map point data.
- `Jingdezhen`: continue focusing on Taoyangli, Imperial Kiln Museum, Taoxichuan, old city / ceramic culture lines, and Sanbao area.
- `Jingdezhen` already has a dedicated multi-day route direction and should keep expanding food and map coordinates.
- `Sanya`: earlier marker issues were fixed around Houhai and related clusters, but map correctness must stay under review whenever route points change.
- `Sanya` routing is organized around `haitang`, `yalong`, and `urban` clusters.

## Files Recently Touched
- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/index/index.wxss`
- `assets/discovery-previews/`

## Git / Handoff
- Repo remote: `https://github.com/alostpig-svg/travel_planner.git`
- Default branch: `main`
- Latest synced commit on `main`: `a112b82`
- Current status should be checked with `git status`
- On a new computer:
  - `git clone`
  - `git pull`
  - read this file first

## Next Recommended Work
- Continue refining the Apple Watch-like discovery selector until drag feel and spatial layout are polished.
- Keep expanding structured city content locally instead of relying on ad-hoc runtime lookup.
- Keep validating route map coordinates whenever food or spot entries change.
