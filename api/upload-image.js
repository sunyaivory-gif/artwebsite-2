import { put } from '@vercel/blob';

function safeFilename(name) {
  const fallback = 'image.jpg';
  return String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function extensionFor(contentType, filename) {
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return '';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/gif') return '.gif';
  return '.jpg';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    const { ADMIN_PASSWORD } = process.env;
    if (!ADMIN_PASSWORD) {
      return res.status(500).send('Missing ADMIN_PASSWORD');
    }

    const { password, filename, contentType, data, purpose = 'image' } = req.body || {};
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).send('Incorrect password');
    }
    if (!contentType?.startsWith('image/') || !data) {
      return res.status(400).send('Invalid image payload');
    }

    const base64 = String(data).includes(',') ? String(data).split(',').pop() : String(data);
    const bytes = Buffer.from(base64, 'base64');
    const safePurpose = safeFilename(purpose).replace(/\.[^.]+$/, '') || 'image';
    const safeName = safeFilename(filename) + extensionFor(contentType, filename);
    const pathname = `site/images/uploads/${safePurpose}-${Date.now()}-${safeName}`;

    const blob = await put(pathname, bytes, {
      access: 'public',
      addRandomSuffix: false,
      contentType
    });

    return res.status(200).json({ ok: true, url: blob.url, pathname: blob.pathname });
  } catch (error) {
    return res.status(500).send(`Image upload error: ${error.message}`);
  }
}
