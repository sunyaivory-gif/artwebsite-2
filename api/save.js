export default async function handler(req, res) {
  try {
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

    const { password, content } = req.body || {};
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).send('Incorrect password');
    }
    if (!content || typeof content !== 'object') {
      return res.status(400).send('Invalid content payload');
    }

    const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content.json`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'artwebsite-online-editor'
    };

    const current = await fetch(`${apiBase}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
    if (!current.ok) {
      return res.status(502).send(`Could not read content.json from GitHub: ${current.status}`);
    }
    const currentJson = await current.json();
    const nextJson = JSON.stringify(content, null, 2);
    const encoded = Buffer.from(nextJson, 'utf8').toString('base64');

    const update = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update website content from online editor',
        content: encoded,
        sha: currentJson.sha,
        branch: GITHUB_BRANCH
      })
    });

    if (!update.ok) {
      const text = await update.text();
      return res.status(502).send(`GitHub update failed: ${text}`);
    }

    return res.status(200).send('Saved content to GitHub. Vercel redeploy will start automatically.');
  } catch (error) {
    return res.status(500).send(`Online save error: ${error.message}`);
  }
}
