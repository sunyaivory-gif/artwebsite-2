# Online Editing Setup

This project saves live editable content to Vercel Blob.

## Required Vercel Setup

Add these in Vercel project settings:

- `ADMIN_PASSWORD` - the password used for online edit mode and online saves.
- Vercel Blob store connected to the project.

The browser cannot change `ADMIN_PASSWORD`. To change the online editor password, update the Vercel environment variable and redeploy.

## Runtime Content Flow

1. Vercel deploys `index.html` from GitHub `main`.
2. The page loads `/api/content`.
3. `/api/content` reads `site/content.json` from Vercel Blob.
4. If Blob content is unavailable, `/api/content` falls back to repo `content.json`.

## Online Save Flow

1. Open the Vercel site with `#edit`.
2. Enter the `ADMIN_PASSWORD`.
3. Make changes in the editor.
4. Click `Save HTML`.
5. The browser uploads any new embedded image data through `/api/upload-image`.
6. The browser sends the complete content JSON to `/api/save`.
7. `/api/save` writes `site/content.json` to Vercel Blob.
8. Reloading the page reads the saved Blob content through `/api/content`.

## Repairing Blob Content

If saved content is missing image `src` values, run `/api/bootstrap-blob` with the admin password.

That endpoint uploads repo image assets to Vercel Blob and writes repaired content to `site/content.json`, while preserving current live Blob metadata/order when possible.

## Security Note

Do not put `ADMIN_PASSWORD` inside `index.html`. It belongs only in Vercel environment variables.
