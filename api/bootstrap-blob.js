import { list, put } from '@vercel/blob';
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

function keyForArt(item) {
  return String(item?.title || '').trim().toLowerCase();
}

function keyForTravel(item) {
  return [item?.caption, item?.location, item?.alt]
    .map(value => String(value || '').trim().toLowerCase())
    .join('|');
}

function mapBy(items, keyFn) {
  const mapped = new Map();
  for (const item of items || []) {
    const key = keyFn(item);
    if(key && !mapped.has(key)) mapped.set(key, item);
  }
  return mapped;
}

async function readCurrentBlobContent() {
  const blobs = await list({ prefix: CONTENT_PATH, limit: 1 });
  const blob = blobs.blobs.find(item => item.pathname === CONTENT_PATH) || blobs.blobs[0];
  if (!blob?.url) return null;

  const freshUrl = `${blob.url}${blob.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(freshUrl, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

function mergeCurrentContent(current, seeded) {
  if (!current || typeof current !== 'object') return seeded;

  const merged = {
    ...seeded,
    ...current,
    site: { ...seeded.site, ...current.site },
    about: { ...seeded.about, ...current.about }
  };

  if (!merged.about.heroImage) merged.about.heroImage = seeded.about?.heroImage;

  const seededArt = mapBy(seeded.art, keyForArt);
  merged.art = Array.isArray(current.art)
    ? current.art.map((item, index) => ({
        ...(seeded.art?.[index] || {}),
        ...item,
        src: item.src || seededArt.get(keyForArt(item))?.src || seeded.art?.[index]?.src
      }))
    : seeded.art;

  const seededTravel = mapBy(seeded.travel, keyForTravel);
  merged.travel = Array.isArray(current.travel)
    ? current.travel.map((item, index) => ({
        ...(seeded.travel?.[index] || {}),
        ...item,
        src: item.src || seededTravel.get(keyForTravel(item))?.src || seeded.travel?.[index]?.src
      }))
    : seeded.travel;

  return merged;
}

function validateImageSources(content) {
  const missing = [];
  if (!content.about?.heroImage) missing.push('about.heroImage');
  (content.art || []).forEach((item, index) => {
    if (!item.src) missing.push(`art[${index}]`);
  });
  (content.travel || []).forEach((item, index) => {
    if (!item.src) missing.push(`travel[${index}]`);
  });
  if (missing.length) {
    throw new Error(`Missing image src after repair: ${missing.join(', ')}`);
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
    const current = await readCurrentBlobContent();
    const repairedContent = mergeCurrentContent(current, content);
    validateImageSources(repairedContent);

    await put(CONTENT_PATH, JSON.stringify(repairedContent, null, 2), {
      access: ACCESS,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json'
    });

    return res.status(200).json({
      ok: true,
      message: 'Moved content and images to Vercel Blob.',
      uploadedImages: Object.keys(urlByPath).length,
      preservedCurrentContent: !!current
    });
  } catch (error) {
    return res.status(500).send(`Blob bootstrap failed: ${error.message}`);
  }
}
