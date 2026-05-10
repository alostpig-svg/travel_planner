# Project Memory

## Goal
- Build a WeChat mini program for travel planning.
- Focus on young users who care about real experience, not ad-heavy content.
- Core output: a clear, executable day-by-day route table.

## Current Product Decisions
- Modes: `relaxed` and `hardcore`.
- Main cities: `Suzhou`, `Jingdezhen`, `Sanya`.
- `Hainan` was removed as a top-level entry.
- Home page was simplified and `今日推荐` was removed.
- Route map was added and must show only trustworthy markers.

## Important Logic
- Content should be filtered and stored locally first.
- Social platforms are only for assisted collection, not the live source for every user request.
- Hotel selection should favor mid/high quality only.
- Food selection must separate `main meal` vs `snack/drink`.
- No duplicate meals across days.
- Map markers need region checks and confidence filtering.

## City Notes
- `Suzhou`: focus on old town, Jinji Lake, and Taihu/Xishan.
- `Suzhou` content should include real food, cafes, hotels, and route-linked map points.
- `Jingdezhen`: focus on `陶阳里-御窑博物院`, `陶溪川创意街区`, `古窑-老城南线`, and `三宝国际瓷谷`.
- `Jingdezhen` content should include museum-led history, heritage layers like `观音阁陶耕艺术聚落` and `湖田古瓷窑址`, night market / street activity, local snacks, and stay options near陶溪川 or陶阳里.
- `Jingdezhen` now has a dedicated 3-day route template instead of relying only on the generic city route.
- `Sanya`: core issue fixed was wrong markers, especially Houhai Village.
- `Sanya` is split into `haitang`, `yalong`, and `urban` clusters for routing.

## Git / Handoff
- Repo remote: `https://github.com/alostpig-svg/travel_planner.git`
- Default branch: `main`
- On a new computer:
  - `git clone`
  - `git pull`
  - read this file first

## What To Do Next
- Keep expanding city content as structured local data.
- Keep refining route templates per city.
- Keep map data aligned with real regions.
