# Vercel Blob Save Fix Plan

## Status

Rewritten after Claude's review in `BLOB_SAVE_FIX_PLAN_REVIEW.md`.

The original diagnosis is still valid, but the implementation plan now needs to be more concrete about:
- repairing the current broken Blob state,
- async image upload before save,
- preserving existing Blob URLs,
- avoiding partial saves,
- and clarifying the online password behavior.

## Current Architecture

- Vercel deploys `index.html` from GitHub `main`.
- The live page loads runtime content from `/api/content`.
- `/api/content` reads Vercel Blob path `site/content.json`.
- The online save button posts to `/api/save`.
- `/api/save` writes back to Vercel Blob path `site/content.json`.
- `/api/upload-image` already uploads image data to Vercel Blob and returns a public Blob URL.
- `/api/bootstrap-blob` already exists and can seed Blob content/images from repo `content.json`.

The save/load paths are correct. The bug is content shape, not the path.

## Root Cause

`buildOnlineContentPayload()` currently removes `data:image/...` sources before saving:

```js
if(item && item.src && item.src.startsWith('data:image/')) delete item.src;
```

Because the deployed image data is currently embedded as `data:image/...`, saved Blob content ends up with Art and Places items that have captions/descriptions/order but no `src`.

On reload:
1. Browser loads GitHub-deployed `index.html`.
2. Browser fetches `/api/content`.
3. Blob content overlays embedded content in `mergeSavedContent()`.
4. Because Blob items are missing `src`, the embedded image source survives by array index.
5. Text/order metadata can change in Blob, but visible images snap back to embedded order.

## Password Issue

The editor's "New password" UI changes `CONTENT.password`.

That only controls local/offline edit mode. On Vercel, authentication uses the `ADMIN_PASSWORD` environment variable in Vercel and the browser cannot change that environment variable.

Decision for implementation:
- On Vercel/online hosts, disable the "New password" input and label it clearly as managed in Vercel project settings.
- Keep local password editing available for localhost/file usage.

## Image Source States

The save code must distinguish these cases:

| Source state | Example | Correct behavior |
| --- | --- | --- |
| Data URI | `data:image/jpeg;base64,...` | Upload through `/api/upload-image`, then replace with returned Blob URL before save |
| Blob/public URL | `https://...blob.vercel-storage.com/...` or another `http` URL | Keep as-is |
| Relative path | `images/art-1-portrait.jpg` | Avoid online if possible; preserve rather than silently deleting |
| Missing `src` | no `src` field | Treat as invalid for art/travel/hero before save; abort with error |

## Implementation Plan

1. Repair the current Blob content state.
   - Run `POST /api/bootstrap-blob` with the real admin password.
   - This should upload repo image assets to Vercel Blob and write `site/content.json` with real image URLs.
   - Before running, confirm whether it would overwrite current live Blob text/order. If current Blob has user edits, repair should merge current live metadata/order with source images instead of blindly replacing it.

2. Preserve current live order while repairing missing image URLs.
   - Read live `/api/content`.
   - Read embedded/repo content with known image sources.
   - Match items by stable fields where possible, such as `title` for art and `caption + location + alt` for travel.
   - Add the correct `src` to each live Blob item without changing its current order/text.
   - Save repaired content to `site/content.json`.

3. Replace the synchronous payload builder with an async online payload preparation step.
   - Current flow:
     ```text
     buildOnlineContentPayload() -> writeViaVercel() -> /api/save
     ```
   - New flow:
     ```text
     prepareOnlineContentPayload()
       -> upload any data:image src through /api/upload-image
       -> replace data URI with returned Blob URL in CONTENT and payload
       -> validate every art/travel item has src
       -> /api/save
     ```

4. Update `writeViaVercel()`.
   - Await the async payload preparation before calling `/api/save`.
   - If any image upload fails, abort the save and show the error toast.
   - Do not save partial content where some images have Blob URLs and others are missing `src`.

5. Update image handling in the payload.
   - Preserve Blob/public `http` URLs.
   - Preserve relative paths if they appear, but do not delete them silently.
   - Upload `data:image/...` values through `/api/upload-image`.
   - Include repaired `src` values in the final `/api/save` payload.

6. Handle `about.heroImage`.
   - Do not delete `about.heroImage` blindly.
   - Apply the same source-state logic:
     - upload data URI,
     - keep Blob/public URL,
     - preserve relative path,
     - error if missing when needed.

7. Fix online password UI.
   - On Vercel/online host, disable the password-change input.
   - Show text such as: `Online password is managed in Vercel project settings as ADMIN_PASSWORD.`
   - Keep local password editing for local/offline usage.

8. Update stale documentation.
   - `ONLINE_EDITING_SETUP.md` still describes an older GitHub-commit save flow.
   - Rewrite it to describe current Blob flow:
     - `/api/content` reads `site/content.json`,
     - `/api/save` writes `site/content.json`,
     - `/api/upload-image` stores images,
     - `ADMIN_PASSWORD` controls online edit/save access,
     - Blob store must be connected/configured in Vercel.

9. Deploy.
   - Commit and push to GitHub `main`.
   - Let Vercel redeploy.

## Test Plan

Pre-deployment/local static checks:
- Run `git diff --check`.
- Check JavaScript syntax if a parser/runtime is available.
- Confirm only intended files changed.

Live verification after deploy:
1. Run `/api/content` and verify every art item has `src`.
2. Run `/api/content` and verify every travel item has `src`.
3. Verify `about.heroImage` is present or intentionally handled.
4. Save an item with an existing Blob URL and confirm the URL is preserved.
5. Save an item with a `data:image/...` source and confirm it uploads to Blob and saves the returned URL.
6. Reorder Art images, save, reload, confirm visual order persists.
7. Reorder Places images, save, reload, confirm visual order persists.
8. Change only a caption, save, reload, confirm caption persists and image stays correct.
9. Use a wrong password and confirm edit mode/save is rejected before any upload.
10. Use the correct password and confirm save writes to Blob.
11. Confirm `/api/content` returns valid JSON after save.

## Failure Handling

- If upload of any image fails, abort the full save.
- Show a clear online save error.
- Do not call `/api/save` after a failed image upload.
- Do not write a payload where Art, Places, or hero items lost their `src`.

## Notes

- The project should continue using Vercel Blob as the source of live editable content.
- GitHub `index.html` remains the deployed shell and fallback.
- The fix should not change the visual layout or public browsing behavior.
