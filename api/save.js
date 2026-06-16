function extractContent(html) {
  const match = html.match(/<script id="content-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('content-data script not found in index.html');
  return JSON.parse(match[1]);
}

function replaceContent(html, content) {
  const json = JSON.stringify(content, null, 2);
  return html.replace(
    /<script id="content-data" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="content-data" type="application/json">${json}</script>`
  );
}

function mergeItem(currentItem = {}, incomingItem = {}) {
  return {
    ...currentItem,
    ...incomingItem,
    src: incomingItem.src || currentItem.src
  };
}

function mergeContent(current, incoming) {
  const merged = {
    ...current,
    ...incoming,
    about: {
      ...current.about,
      ...incoming.about,
      heroImage: incoming.about?.heroImage || current.about?.heroImage,
      contact: {
        ...current.about?.contact,
        ...incoming.about?.contact
      }
    }
  };

  if (Array.isArray(incoming.art)) {
    merged.art = incoming.art.map((item, index) => mergeItem(current.art?.[index], item));
  }
  if (Array.isArray(incoming.travel)) {
    merged.travel = incoming.travel.map((item, index) => mergeItem(current.travel?.[index], item));
  }

  return merged;
}

async function readCurrentHtml(currentJson, headers) {
  if (currentJson.content && currentJson.encoding === 'base64') {
    return Buffer.from(currentJson.content, 'base64').toString('utf8');
  }

  if (!currentJson.download_url) {
    throw new Error('GitHub did not provide file content or a download URL');
  }

  const raw = await fetch(`${currentJson.download_url}?t=${Date.now()}`, {
    headers: {
      ...headers,
      Accept: 'text/plain'
    }
  });
  if (!raw.ok) {
    throw new Error(`Could not download current index.html: ${raw.status}`);
  }
  return raw.text();
}

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

    const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/index.html`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'artwebsite-online-editor'
    };

    const current = await fetch(`${apiBase}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
    if (!current.ok) {
      return res.status(502).send(`Could not read index.html from GitHub: ${current.status}`);
    }
    const currentJson = await current.json();
    const currentHtml = await readCurrentHtml(currentJson, headers);
    const currentContent = extractContent(currentHtml);
    const mergedContent = mergeContent(currentContent, content);
    const nextHtml = replaceContent(currentHtml, mergedContent);
    const encoded = Buffer.from(nextHtml, 'utf8').toString('base64');

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
