# Building Lektura: the bugs, the dead ends, and what they taught us

Lektura turns Korean university course material into an English translation,
a chatbot that answers only from the document, flashcards and a quiz. It was
scoped as a four-hour MVP.

This is the honest engineering log — what broke, what we misdiagnosed, and
the concepts each problem forced us to learn. The wrong turns are included
deliberately, because they were where most of the learning happened.

> No API keys appear in this document. That is not an accident — see
> problem #2.

---

## 1. The provider problem: no key, no budget

**The situation.** The spec called for Anthropic's Claude. We had no API key,
and Anthropic has no free tier.

**What we did.** Surveyed what's actually free with no credit card: Google
Gemini, Groq, Mistral, OpenRouter. Picked Gemini — free, generous context,
and strong Korean.

But the more interesting decision was structural: rather than hard-wiring
Gemini everywhere, we put every provider behind one interface:

```js
provider.generate({ system, prompt, history, document, json })
provider.startUpload({ name, mimeType, size })
```

**Concept — the adapter pattern.** Code above `server/providers/` doesn't know
which AI company it's talking to. Switching providers is one line in `.env`:

```bash
AI_PROVIDER=gemini      # or anthropic
```

This paid off immediately and repeatedly. When Gemini's behaviour surprised
us, the blast radius was one file.

**Takeaway:** when a dependency is chosen under constraint — no budget, no
key, whatever — assume the constraint will change and put a seam there.

---

## 2. The API key we leaked to a public repo

The most important lesson of the project, and the most uncomfortable.

**What happened, in order:**

1. The key was pasted directly into `server/providers/gemini.js`, replacing
   `env.GEMINI_API_KEY`.
2. It was then pasted into `.env.example` — the *committed* template file.
3. Both got committed and pushed to a **public** GitHub repo.

**Why `.gitignore` didn't save us.** `.env` was gitignored from the very first
commit. That is necessary but not sufficient, because IDEs offer an "Add to
VCS" prompt that *force-adds ignored files*. A gitignore entry is a default,
not a lock.

**The fix, in priority order — and the order matters:**

1. **Revoke the key.** First. Always first.
2. Remove the commits from the remote.
3. Make the repo private.

**Concept — a leaked secret cannot be un-leaked.** Public repositories are
scraped by bots within seconds. Rewriting history removes it from the branch,
but GitHub keeps orphaned commits reachable by SHA for a while, and anyone
who already copied it still has it. History rewriting is hygiene; **rotation
is the actual fix.**

We verified the revocation instead of assuming it:

```
HTTP 400 — "API key not valid. Please pass a valid API key."
```

That verification step matters. "I deleted it" and "it is dead" are different
claims, and only one of them is testable.

**Concept — `VITE_` and the public/private boundary.** Vite will only expose
environment variables to browser code if they're prefixed `VITE_`. Ours is
deliberately *not*:

```bash
GEMINI_API_KEY=...     # server-only. Vite refuses to inline it.
```

The bundler enforces the boundary. We verify it rather than trust it — after
each build, `GEMINI_API_KEY` appears nowhere in `dist/`.

**Takeaway:** `.env` in `.gitignore` is step one of several. Verify what's in
the commit, not what you intended to put there.

---

## 3. Garbled Korean, and why we stopped extracting text

**The problem.** The obvious pipeline is: PDF → extract text with pdf.js →
send text to the AI. With Korean lecture slides this produces garbled,
out-of-order text. Slides are visually laid out, not linear documents; text
extraction reads boxes in creation order, not reading order.

**The fix.** Send the PDF itself. Gemini accepts PDFs natively and reads them
as documents — layout, tables and reading order intact.

**Concept — multimodal input.** Modern models accept PDFs and images
directly. Reaching for a text-extraction library first is a habit worth
questioning: it can *destroy* information the model would otherwise have.

pdf.js is still in the project — but only to *display* the document to the
student, which is what it's good at.

**The catch that shaped a later feature:** Gemini accepts PDF, images, text,
audio and video — but **not** Word or PowerPoint. Those need extracting to
text after all. So the prompt templates were built from day one to accept
*either* an attached document or inlined text:

```js
function materialBlock(courseMaterial) {
  if (!courseMaterial) {
    return 'The course material is the PDF document attached to this message.';
  }
  return `Course material:\n"""\n${courseMaterial}\n"""`;
}
```

That small piece of foresight made docx/pptx support a much smaller change
later.

---

## 4. "This model is no longer available to new users"

The first real AI call failed:

```
404 — This model models/gemini-2.5-flash is no longer available to new users.
```

A model we'd targeted had been closed to new API keys. Listing what the key
could actually reach showed a dozen newer options, and the error itself named
the replacement.

**Concept — model IDs are not stable infrastructure.** They get deprecated,
retired and closed to new accounts. Treat the model as configuration
(`GEMINI_MODEL` in `.env`), not a constant, and make the failure legible when
it happens.

---

## 5. "High demand": the free tier fights back

Intermittently, calls returned:

```
503 — This model is currently experiencing high demand.
```

Nothing was wrong with our code. Free-tier capacity is contended, and the
longer the request, the likelier it is to bounce. A 53-page PDF translation
got hit repeatedly.

**The fix — retry with exponential backoff:**

```js
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
// attempt 1 → wait 1.2s → attempt 2 → wait 2.4s → attempt 3
```

**Concept — transient vs permanent failure.** `400 bad request` will fail
identically forever; retrying wastes time. `503` is a temporary condition and
often succeeds on the next attempt. Classify errors before deciding how to
react. Our translation only succeeded because of this — the logs show
`[gemini] 503 on attempt 1/3; retrying in 1200ms` right before it worked.

---

## 6. The blank screen: three diagnoses, two of them wrong

The hardest bug, and the best story.

**The report:** "I upload a document, click the Flashcards or Quiz tab, and it
comes up blank."

### Wrong diagnosis #1: an infinite render loop

`App.jsx` passed `flashcards.data?.cards ?? []`. That `[]` is a **new array on
every render**, and `FlashcardDeck` reset its state whenever `cards` changed
identity. Combined with `setSeen(new Set())` — a new identity every time, so
React can never bail out — that looked like a guaranteed infinite loop.

Confident, plausible, and **wrong**. A headless mount rendered it in 2 renders
with no errors. The effect only refires when the *parent* re-renders, and the
deck setting its own state doesn't do that.

*(It was still a real latent bug — the student's place in the deck was
discarded whenever App re-rendered for any unrelated reason. Fixed with a
module-level constant. But it wasn't the blank screen.)*

### Wrong diagnosis #2: missing CSS surface

Next theory: the empty state had no card surface behind it, so an
ungenerated deck read as an empty page. True as a design flaw, fixed — and
still not the bug.

### The harness lied to us twice

Two "failures" during investigation weren't app bugs at all:

- `ReferenceError: React is not defined` — the test bundler used the classic
  JSX transform while Vite uses the automatic runtime.
- `endRef.current.scrollIntoView is not a function` — jsdom doesn't implement
  it; real browsers do.

**Concept — distrust your instrumentation.** Both looked like genuine
findings. Reporting either as "the bug" would have sent everyone down a dead
end. When a test fails, the first question is whether the *test* is wrong.

### The actual cause

The breakthrough was a detail in the report: it only broke **after uploading a
document**.

That pointed at `PdfViewer`'s unmount. Switching tabs unmounts it, and its
cleanup ran:

```js
useEffect(() => () => {
  renderTaskRef.current?.cancel();
  docRef.current?.destroy();   // only does anything if a document is loaded
}, []);
```

**Concept — React's commit phase is unforgiving.** Effect cleanups run during
commit. A throw there isn't contained to the component: React tears down the
**entire root**. Every tab goes blank, with no error message, and stays blank
until reload.

That matched the symptom exactly: nothing before upload (cleanup is a no-op),
everything broken after.

Proven with a component that throws from its cleanup:

| | Result after tab switch |
|---|---|
| Without an error boundary | `""` — blank page |
| With an error boundary | Error shown, app alive |

### Two fixes, because one wasn't enough

1. **Harden the cleanup** — clear refs first so double-destroy can't happen,
   wrap each call, absorb the promise rejection.
2. **Add an `ErrorBoundary`** — the structural fix. The deeper problem was
   never "this one throw"; it was that *any* fault anywhere blanked the whole
   app silently.

**Takeaway:** fixing the specific throw treats the symptom. The real defect
was an architecture with no containment. Ask "why did this failure become
catastrophic?", not just "what threw?".

---

## 7. It worked locally and was dead on arrival in production

The site deployed. The UI loaded. Every AI feature failed.

```
/api/health     404  text/html
/api/documents  404  text/html
/api/ai         404  text/html
```

**The cause.** The whole API existed as **Vite dev-server middleware**
(`configureServer`). That hook only exists while `vite dev` runs. `vite build`
emits static files and cannot produce it. Nothing in `dist/` could ever answer
`/api/*`.

**Concept — dev/prod parity.** A dev server is not a small production server;
it's a different thing. Anything that only exists in dev will be missing in
production.

**The fix.** Move the behaviour into `server/handlers.js` and serve it through
two thin adapters:

```
server/handlers.js          ← all real behaviour
   ├── server/aiProxy.js            Vite middleware  (dev)
   └── netlify/functions/*.mjs      serverless       (prod)
```

The adapters only translate HTTP plumbing. The logic can't drift because
there's only one copy.

---

## 8. The 6MB wall, and uploading around it

Serverless functions cap request bodies — Netlify at roughly 6MB. A 5.6MB PDF
becomes ~7.5MB as base64. The file could not pass through the function at all.

Worse, the original design kept uploaded PDFs in an in-memory `Map`. That's
fine for one long-lived dev server and **impossible** for serverless, where
each invocation may be a different instance with different memory.

**Concept — serverless is stateless.** Anything you put in a module-level
variable can vanish between requests.

**The solution — hand the browser a tokenised upload URL:**

```
browser ──POST /api/documents──▶ function mints a resumable upload URL
                                  (holds the key; URL contains none)
browser ───────bytes───────────▶ Google's upload endpoint (direct)
browser ──POST /api/ai─────────▶ function generates, citing the file URI
```

The file never touches our server, so the 6MB limit is irrelevant. Chat turns
then carry a URI instead of megabytes.

**Concept — verify the risky assumptions before building on them.** Three
things had to be true, and each was tested first:

1. Does the minted URL contain the API key? → **No.** Safe for the browser.
2. Will the browser be *allowed* to upload cross-origin? → CORS preflight
   returned `access-control-allow-origin` for our exact site origin. **Yes.**
3. Can the model generate from a file URI? → Uploaded a tiny file, asked a
   question with a known answer, got it right. **Yes.**

Building first and discovering a CORS wall afterwards would have wasted the
whole design.

This also fixed a dev-only bug for free: restarting the dev server used to
lose the document ("That document is no longer on the server").

---

## 9. The wall we haven't climbed yet: 10 seconds

Still open at time of writing, and worth documenting honestly.

**Netlify kills synchronous functions after 10 seconds.** Measured:

| Call | Time | Fits in 10s? |
|---|---|---|
| Chat | ~7s | barely |
| Flashcards | ~30s | no |
| Quiz (18 questions) | ~68s | no |
| Full translation | **~268s** | nowhere close |

Translation is slow because it's a *complete* translation of a 53-page
lecture, not a summary. That's the product working as intended.

**Concept — synchronous request/response has a ceiling.** Past roughly a
minute, holding a connection open stops being viable anywhere. The answer
isn't a bigger timeout; it's to stop waiting:

1. Browser: "start the translation" → gets a ticket immediately
2. Background job does the work (Netlify allows 15 minutes)
3. Browser polls until the result appears

Like a print queue: submit the job, collect it when ready.

**Takeaway:** measure before you design. Building sync functions and
discovering the 10s cap afterwards meant reworking a layer that was already
written. One search up front would have caught it.

---

## 10. Smaller things worth knowing

**Korean renders as tofu boxes.** The design system's typeface (Chillax) has
no Hangul glyphs. Every font stack needed a Korean fallback appended —
easily missed when the UI chrome is English and only the *content* is Korean.

**LLMs don't reliably return clean JSON.** Even instructed not to, they wrap
output in ```json fences. Every response is defensively unwrapped, parsed in
a try/catch, and falls back to the outermost `{...}` span.

**Validate model output as untrusted input.** A multiple-choice question
whose `correctAnswer` isn't among its `options` is unanswerable. Those get
dropped — showing the student one fewer question beats showing one with no
right answer.

**Two independent personalization dials.** Korean level controls *language
complexity*; learning goal controls *content emphasis*. Keeping them separate
in the prompt — rather than collapsing into one "level" — is what makes
"Beginner + exam prep" and "Advanced + exam prep" behave sensibly.

**Grounding must be tested, not assumed.** The requirement is that the bot
never invents. We tested it adversarially — asked for the professor's
birthday and home address, information nowhere in the document:

> 제공된 강의 자료에는 교수의 생일이나 집 주소에 대한 정보가 포함되어 있지 않습니다.
> *(The provided lecture material does not contain information about the
> professor's birthday or home address.)*

A prompt instruction is a hope until you've tried to break it.

---

## What the project actually taught us

**Verify, don't assume.** Nearly every real problem here came from an
unexamined assumption: that the dev middleware would deploy, that functions
could run for a minute, that a file could be proxied, that a gitignore
prevents commits.

**Test the risky thing first.** CORS and the upload-URL design were verified
before a line of the feature was written. That is the difference between a
30-minute build and a wasted afternoon.

**Your tools lie too.** Two "bugs" during the blank-screen hunt were broken
test harness, not broken app.

**Contain failures.** The blank screen wasn't really about pdf.js. It was
about an app where one throw anywhere killed everything.

**Symptoms are data — take the detail seriously.** "It only breaks *after I
upload*" was the sentence that cracked the hardest bug, after two confident
wrong theories.
