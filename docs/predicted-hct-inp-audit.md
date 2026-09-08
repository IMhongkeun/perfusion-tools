# Predicted Hct `#prime` INP audit

## Decision

No calculator bottleneck was established. The approximately two-second field
sample should be treated as an outlier or as main-thread contention around the
interaction, not as evidence that the hematocrit arithmetic is slow. No
production behavior was changed.

The audit was performed from commit `5fd3df7`, which contains the merge of PR
#161. This environment has no Chromium, Chrome, Playwright, or Puppeteer
runtime, so it cannot produce trustworthy Event Timing or trace measurements.
No timing values are inferred from the static audit.

## Synchronous `#prime` path

A trusted user `input` event takes this path, in event-dispatch order:

1. The capturing `input` listener on the calculator's `main` element, installed
   by `initFeedbackCard()`, marks the page as interacted with and calls
   `setTimeout(evaluate, 0)`. It does not synchronously run readiness checks,
   access storage, or insert feedback DOM.
2. The sole target listener for `#prime`, installed by the Predicted Hct wiring
   array, calls `updateHct()`.
3. `updateHct()` reads the mode and obtains stable result/mode elements. It
   reapplies four mode visibility class states and the unchanged Pre-CPB help
   text, reads the seven Pre-CPB values, and calls `computePredictedHct()`.
4. `computePredictedHct()` calls `calculatePreCpbHct()`. That function performs
   finite/range validation and a constant-sized set of multiplications,
   additions, and one division.
5. The valid Pre-CPB result path rewrites the unchanged `EBV` and `Total Vol`
   labels, restores the unchanged help text, and writes EBV, total volume, and
   predicted Hct result content. There are no layout reads, computed-style
   reads, storage calls, network calls, timers, loops over page content, or
   On-pump Target Hct calculations on this path.
6. The bubbling document analytics listener checks trust and the input type,
   calls the deduplicated `calculator_start` path, and schedules
   `checkCompletion` with `setTimeout(..., 0)`. Readiness evaluation and
   `calculation_complete` therefore occur after dispatch, not synchronously in
   the input handler.

After dispatch, the feedback and analytics zero-delay tasks can perform their
readiness checks. During the first 15 seconds the feedback task returns before
storage or DOM insertion. After that dwell period it may check cooldown storage
and result readiness and, when eligible, insert the feedback card. This work is
not part of synchronous event processing, but a task queued by the interaction
can contribute to the time before a browser presents the next frame.

## Listener inventory

- `#prime` has exactly one calculator `input` listener.
- It has no calculator `change` listener and is absent from the On-pump array
  that receives both `input` and `change` listeners.
- No duplicate calculator registration was found: the wiring is inside one
  `DOMContentLoaded` callback, guarded by the page's required elements.
- The event also reaches one feedback capture listener and one analytics bubble
  listener for `input`. Document click/navigation listeners do not run for an
  input event. The analogous global `change` listeners do not run unless a
  separate browser `change` event is later dispatched.

## INP interpretation

- **Input delay:** nothing in the `#prime` path can explain time before dispatch.
  A first interaction can instead wait behind page/runtime work. The page loads
  the Tailwind CDN runtime synchronously in the head, imports two Google Font
  families from CSS, initializes navigation/discovery and all page wiring on
  `DOMContentLoaded`, and loads Google Analytics asynchronously. Tailwind's
  runtime compilation and a coincident asynchronous script task are broader
  candidates, but were not measurable in this environment.
- **Processing duration:** the calculator path is constant-sized arithmetic and
  a small number of DOM lookups/writes. The feedback capture listener only
  schedules work. Analytics does small allowlist/deduplication checks and queues
  completion. Static evidence does not make roughly two seconds of processing
  plausible.
- **Presentation delay:** result text and several already-correct visibility
  classes are written. There are no layout reads after those writes, so no
  forced synchronous layout was found. Normal style/layout/paint remains, and
  initial Tailwind/font activity could increase it, but the audit cannot assign
  a duration.

`updateHct()` does contain avoidable mode-state and unchanged-content writes on
each numeric edit. They are a handful of operations and do not constitute a
defensible explanation for a two-second outlier. Splitting mode rendering from
result rendering without trace evidence would therefore be speculative.

## Evidence needed before optimization

Capture a DevTools Performance trace or Event Timing attribution for fresh-load
and settled interactions on desktop and mobile-sized viewports. Compare Prime,
Weight, Pre-CPB Hct, and RBC units, recording input delay, processing start/end,
presentation delay, and overlapping long tasks. In particular, test an edit
immediately after first paint and again after five seconds. A repeatable long
`updateHct()` task or a style/layout block attributable to its writes would
justify a targeted change; a shared first-interaction stall would instead point
to page/runtime startup work such as Tailwind CDN processing.

