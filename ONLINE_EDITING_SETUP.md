# Online Editing Setup

This project includes `api/save.js`, a Vercel serverless function that lets the online editor save `index.html` back to GitHub.

## Required Vercel Environment Variables

Add these in Vercel project settings under Environment Variables:

- `GITHUB_TOKEN` - a GitHub fine-grained token with read/write Contents access for `sunyaivory-gif/artwebsite-2`
- `ADMIN_PASSWORD` - the same password you use to enter edit mode

Optional, already defaulted in code:

- `GITHUB_OWNER` - `sunyaivory-gif`
- `GITHUB_REPO` - `artwebsite-2`
- `GITHUB_BRANCH` - `main`

## How Online Save Works

1. Open the Vercel site with `#edit`.
2. Enter the editor password.
3. Make changes.
4. Click `Save HTML`.
5. The browser sends the updated HTML to `/api/save`.
6. Vercel commits the new `index.html` to GitHub.
7. Vercel automatically redeploys from GitHub.

## Security Note

Do not put the GitHub token inside `index.html`. It belongs only in Vercel Environment Variables.
