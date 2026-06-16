export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const {
    GITHUB_TOKEN,
    GITHUB_OWNER = 'sunyaivory-gif',
    GITHUB_REPO = 'artwebsite-2',
    GITHUB_BRANCH = 'main',
    ADMIN_PASSWORD
  } = process.env;

  if (!GITHUB_TOKEN || !ADMIN_PASSWORD) {
    return res.status(500).send('Missing server configuration');
  }

  const { password, html } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).send('Incorrect password');
  }
  if (typeof html !== 'string' || !html.includes('<!DOCTYPE html>')) {
    return res.status(400).send('Invalid HTML payload');
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/index.html`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'artwebsite-online-editor'
  };

  const current = await fetch(`${apiBase}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
  if (!current.ok) {
    return res.status(502).send('Could not read index.html from GitHub');
  }
  const currentJson = await current.json();

  const encoded = Buffer.from(html, 'utf8').toString('base64');
  const update = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Update website from online editor',
      content: encoded,
      sha: currentJson.sha,
      branch: GITHUB_BRANCH
    })
  });

  if (!update.ok) {
    const text = await update.text();
    return res.status(502).send(`GitHub update failed: ${text}`);
  }

  return res.status(200).send('Saved to GitHub. Vercel redeploy will start automatically.');
}
