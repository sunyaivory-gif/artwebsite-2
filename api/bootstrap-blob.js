import { put } from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONTENT_PATH = 'site/content.json';
const ACCESS = 'public';

function isLocalImage(src) {
  return typeof src === 'string' && src.startsWith('images/') && !src.includes('..');
}

function contentTypeFor(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function collectImageRefs(content) {
  const refs = new Set();
  if (isLocalImage(content.about?.heroImage)) refs.add(content.about.heroImage);
  for (const item of content.art || []) {
    if (isLocalImage(item.src)) refs.add(item.src);
  }
  for (const item of content.travel || []) {
    if (isLocalImage(item.src)) refs.add(item.src);
  }
  return refs;
}

function replaceImageRefs(content, urlByPath) {
  if (urlByPath[content.about?.heroImage]) content.about.heroImage = urlByPath[content.about.heroImage];
  for (const item of content.art || []) {
    if (urlByPath[item.src]) item.src = urlByPath[item.src];
  }
  for (const item of content.travel || []) {
    if (urlByPath[item.src]) item.src = urlByPath[item.src];
  }
}

function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    const password = req.method === 'POST' ? req.body?.password : req.query?.password;
    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).send('Incorrect password');
    }

    const root = process.cwd();
    const content = JSON.parse(await fs.readFile(path.join(root, 'content.json'), 'utf8'));
    const urlByPath = {};

    const origin = siteOrigin(req);
    for (const ref of collectImageRefs(content)) {
      const imageRes = await fetch(`${origin}/${ref}`);
      if (!imageRes.ok) {
        throw new Error(`Could not read ${ref} from live site: ${imageRes.status}`);
      }
      const body = Buffer.from(await imageRes.arrayBuffer());
      const blob = await put(`site/${ref}`, body, {
        access: ACCESS,
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: contentTypeFor(ref)
      });
      urlByPath[ref] = blob.url;
    }

    replaceImageRefs(content, urlByPath);

    await put(CONTENT_PATH, JSON.stringify(content, null, 2), {
      access: ACCESS,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json'
    });

    return res.status(200).json({
      ok: true,
      message: 'Moved content and images to Vercel Blob.',
      uploadedImages: Object.keys(urlByPath).length
    });
  } catch (error) {
    return res.status(500).send(`Blob bootstrap failed: ${error.message}`);
  }
}
