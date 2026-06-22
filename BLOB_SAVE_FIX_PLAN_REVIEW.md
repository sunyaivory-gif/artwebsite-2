# Codex Blob Save Fix Plan — Updated Review (v2)

**Reviewed by:** Claude (per sunya's request)
**Date:** 2026-06-22
**Plan under review:** `BLOB_SAVE_FIX_PLAN.md` (rewritten after first review)

---

## Verdict: Ready to implement

All 7 gaps from the first review are addressed. The plan is now concrete, testable, and correctly cross-referenced against the actual code. Two minor new notes below, neither blocking.

---

## Gap Closure Check

| # | Original Gap | Status |
|---|---|---|
| 1 | No repair strategy for broken Blob state | ✅ Fixed — steps 1-2 use `/api/bootstrap-blob` + merge approach |
| 2 | No distinction between src states (data URI / Blob URL / relative path) | ✅ Fixed — full table with all four states including missing src |
| 3 | No async upload wiring specified | ✅ Fixed — steps 3-4 detail `prepareOnlineContentPayload()` and `writeViaVercel()` changes |
| 4 | `about.heroImage` stripping not mentioned | ✅ Fixed — step 6 applies same source-state logic to heroImage |
| 5 | Stale `ONLINE_EDITING_SETUP.md` | ✅ Fixed — step 8 rewrites it |
| 6 | No test plan | ✅ Fixed — 11 specific test cases, pre-deployment + live |
| 7 | No failure handling | ✅ Fixed — dedicated "Failure Handling" section with abort-on-any-failure |

---

## Code Verification

I cross-checked every architectural claim against the actual files:

| Claim | Source | Match |
|---|---|---|
| `buildOnlineContentPayload()` strips `data:image/...` | [index.html:2080-2090](artwebsite-2-git/index.html#L2080) | ✅ |
| `mergeSavedContent()` overlays by array index | [index.html:839-851](artwebsite-2-git/index.html#L839) | ✅ |
| `changePassword()` only modifies `CONTENT.password` | [index.html:1948-1962](artwebsite-2-git/index.html#L1948) | ✅ |
| `/api/save` checks `ADMIN_PASSWORD` env var | [api/save.js:11](artwebsite-2-git/api/save.js#L11) | ✅ |
| `/api/content` reads `site/content.json` from Blob | [api/content.js:5-9](artwebsite-2-git/api/content.js#L5) | ✅ |
| `/api/upload-image` exists and requires password | [api/upload-image.js:31-33](artwebsite-2-git/api/upload-image.js#L31) | ✅ |
| `/api/bootstrap-blob` exists and seeds Blob from repo | [api/bootstrap-blob.js:48-91](artwebsite-2-git/api/bootstrap-blob.js#L48) | ✅ |
| Vercel save path is Tier 2 in `tryTieredSave()` | [index.html:2146-2156](artwebsite-2-git/index.html#L2146) | ✅ |

Everything checks out.

---

## 🟡 Two Minor New Notes (not blocking)

### Note 1: Stale toast message

At [index.html:2150](artwebsite-2-git/index.html#L2150), the Vercel save success toast says:

> "Saved online. Vercel is redeploying from GitHub."

This is leftover from the old GitHub-commit flow. The save now goes to Vercel Blob, not GitHub. The plan doesn't mention updating this message.

**Recommendation:** Change to something like `"Saved online to Vercel Blob."` as part of the implementation.

### Note 2: CONTENT mutation side effect

The plan step 3 says to replace data URIs with Blob URLs "in CONTENT and payload." This means after an online save, the in-memory `CONTENT` object will have Blob URLs instead of the original embedded data URIs. If the user then does a local save (`Save HTML` → Tier 3/4), the embedded `content-data` JSON script would serialize with Blob URLs.

In practice this is unlikely to cause problems — the user is either working on Vercel or locally, not both in one session — but it's a subtle state mutation worth being aware of during testing. The local `content.json` fallback in `api/content.js` already has relative `images/` paths, so it won't be affected.

---

## Risk Callout: Repair Step Matching

Step 2 of the plan proposes matching live Blob items to repo items by `title` (for art) and `caption + location + alt` (for travel) to repair missing `src` values without overwriting user reorders. This is reasonable for a one-time repair, but there's a small risk if:

- Two art items have the same title
- Two travel items have the same caption, location, AND alt

If that happens, the matcher could assign the wrong `src` to an item. The plan should note this as a risk and recommend verifying the repair result before trusting it.

---

## Summary

The rewritten plan is thorough and implementation-ready. All architectural claims are verified against the actual code. The two new notes above (stale toast message, CONTENT mutation) are cosmetic and unlikely to cause real problems. The repair matching risk is real but manageable with a quick visual verification after the bootstrap runs.

**Recommended next step:** Codex should implement steps 1-9 in order, fix the toast message while editing `tryTieredSave`, and verify the repair result after step 2 before proceeding to step 3.
