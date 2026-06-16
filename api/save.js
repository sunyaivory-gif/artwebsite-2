import { put } from '@vercel/blob';

const CONTENT_PATH = 'site/content.json';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    const { ADMIN_PASSWORD } = process.env;
    if (!ADMIN_PASSWORD) {
      return res.status(500).send('Missing ADMIN_PASSWORD');
    }

    const { password, content } = req.body || {};
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).send('Incorrect password');
    }
    if (!content || typeof content !== 'object') {
      return res.status(400).send('Invalid content payload');
    }

    await put(CONTENT_PATH, JSON.stringify(content, null, 2), {
      access: 'public',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json'
    });

    return res.status(200).send('Saved content to Vercel Blob.');
  } catch (error) {
    return res.status(500).send(`Online save error: ${error.message}`);
  }
}
