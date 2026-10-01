# Audio lifecycle ownership pass

This pass preserves the score, effects, gains, filters, fades, room acoustics and cue timing. Music and procedural effects still share one AudioContext, created only after sound is requested. No application timer or animation loop was added.

## Baseline evidence

On the production baseline at `d35a3a6`, Chrome phone emulation reproduced two control races:

- `enable()` immediately followed by `disable()` could finish its pending promise afterward, restore `state = playing` and schedule a fade toward audible volume despite `wantsSound = false`.
- A suspended context whose `resume()` was rejected by a simulated browser policy armed a gesture retry. Disabling sound did not remove it; the next unrelated click resumed the disabled AudioContext.

The baseline also retained music gain/filter references after destruction. Cue and portal sources stopped at their scheduled ends but did not explicitly disconnect their downstream branches. The latter is an ownership ambiguity, **not proof of an indefinitely growing native audio heap**: browsers can garbage-collect finished audio graphs.

## Targeted changes

- Pending playback/resume requests check their generation, current element and visitor choice before changing state or fades. Both the playback and context promises are handled together, preventing an abandoned play rejection from going unhandled.
- Disabling sound removes policy-retry listeners and pending metadata seeks, invalidates old requests, and cancels the existing portal-duck restoration callback.
- Destruction removes media/context listeners, stops media fetching, disconnects the music graph and drops its references.
- Effects own sounding cue branches; their existing `ended` events disconnect them. Portal branches use the same event-based cleanup. Silent beds retain their existing four-second parking behavior.
- Experience teardown releases the shared effects bus, compressor, bed nodes, noise buffers and context references before closing the music context. Replacing that context also releases the previous effects graph.

## Repeatable verification

```
node scripts/qa/audio-lifecycle.mjs http://localhost:3303 --baseline
node scripts/qa/audio-lifecycle.mjs http://localhost:3303
```

The fixture transpiles the actual repository audio modules into an isolated Chrome document on the supplied origin, so it tests real media/Web Audio lifecycle without rendering a second WebGL scene. `--baseline` reads HEAD without changing the repository. The policy and visibility cases are simulated; physical mobile audio interruptions and Safari are not verified by this fixture.

Verified with the replacement-graph assertions: baseline **5 passed / 8 failed**; working-tree implementation **13 passed / 0 failed**, no browser runtime errors. Both versions created exactly one context and one media source during repeated enables. Closing and explicitly rebuilding created one new context, not parallel persistent contexts. The fixed version explicitly disconnected all 14 scheduled cue/portal/bed sources exercised across both graphs; the baseline explicitly disconnected none. That count measures deterministic cleanup, not native audio-memory savings or sound quality.

Initial loading remains unchanged: the renderer chunk is prefetched while web fonts resolve; generated world resources warm behind the loader; Crew prints preload at the portal; audio preload creates no context; score buffering is bounded and allows gesture-held media. No evidence justified replacing those working systems.
