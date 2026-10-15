# JC vs. the Devil — Clean Freestyle Battle

**Added to both JC launch pages:** the in-game RAP BATTLE button opens `battle-rap.html` in an overlay, without unloading the world.

## Gameplay

- JC writes original bars, or uses the MIC button if browser speech recognition is supported.
- A completed microphone transcript that includes profanity immediately disqualifies JC.
- Typed text is checked at submission, not while the player is drafting. A live hint warns if the draft contains a curse.
- All recognized curse variations, including mild words such as "damn", "hell", and "crap", end the match immediately; the opponent's words never trigger JC's loss.
- Every clean round gets a Devil rebuttal. JC and the Devil receive game scores, and the highest score after three rounds wins.
- Local rule-based responsive rebuttals work offline. **They are not generative AI.** The UI labels them clearly.
- The browser never stores an API key.

## Activating actual AI Devil rebuttals

The game is currently deployed to **GitHub Pages, which serves static files only**. The included Cloudflare Worker must be deployed separately before the Devil uses a live model.

1. From your Cloudflare account, open `workers/wrangler.toml` and replace `ALLOWED_ORIGINS` with the exact JC game origin, including the scheme, and change `namespace_id` if needed.
2. Run `npx wrangler login`, then `npx wrangler secret put OPENAI_API_KEY --config workers/wrangler.toml` and paste the key into the secure CLI prompt. Never commit it.
3. Run `npx wrangler deploy --config workers/wrangler.toml` from the repository root. Confirm the Worker URL works with your origin. The Worker has a per-IP Cloudflare rate-limit binding (10 requests/minute) and checks clean-language compliance again on the server.
4. Put the resulting HTTPS Worker URL in `jc-the-holy-og-assets/rap-config.js` as `window.JC_RAP_AI_ENDPOINT`. **This URL is public; it must not contain an API token.**
5. Deploy JC and check the game label changes to **LIVE AI DEVIL** after an actual successful model response. If the Worker fails, gameplay falls back to **LOCAL RIVAL • AI UNAVAILABLE**.

### Deployment caveats

- An Origin check and per-IP rate limit reduce casual abuse but do not authenticate users. Add signed account sessions, tighter account quotas, and monitoring before exposing a paid model to significant public traffic. Keep the Worker disabled until security and billing limits are accepted.
- Word-list matching is strict but cannot guarantee detection of all invented pronunciations, spelling tricks, non-English profanity, or speech recognition mistakes. Add server-side moderation and human testing if competitive enforcement becomes important.
- Speech recognition depends on browser support, microphone permission, and device transcription; manual typed battles are always available.
- Game scoring is a transparent local heuristic, not a formal LLM judge. AI replies are generated for dramatic dialogue, not authoritative scoring.

## Test

```sh
node tests/rap-guard-smoke.cjs
node --check jc-the-holy-og-assets/battle-rap-engine.js
node --check workers/jc-rap-ai.js
```
