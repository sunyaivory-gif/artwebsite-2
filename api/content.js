import { list } from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_PATH = 'site/content.json';

export default async function handler(req, res) {
  try {
    const blobs = await list({ prefix: CONTENT_PATH, limit: 1 });
    const blob = blobs.blobs.find(item => item.pathname === CONTENT_PATH) || blobs.blobs[0];

    if (blob?.url) {
      const freshUrl = `${blob.url}${blob.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const blobRes = await fetch(freshUrl, { cache: 'no-store' });
      if (blobRes.ok) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).send(await blobRes.text());
      }
    }

    const fallback = await fs.readFile(path.join(process.cwd(), 'content.json'), 'utf8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(fallback);
  } catch (error) {
    return res.status(500).send(`Could not load content: ${error.message}`);
  }
}
