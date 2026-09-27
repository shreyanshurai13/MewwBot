import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png' };

async function loadEnv() {
  try {
    const text = await readFile(join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function getBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw Object.assign(new Error('That message is a bit too long.'), { status: 413 });
  }
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('Please send a valid message.'), { status: 400 }); }
}

async function handleChat(req, res) {
  if (!process.env.AI_API_KEY) return json(res, 503, { error: 'Add your AI_API_KEY to .env, then restart the server.' });
  const body = await getBody(req);
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) return json(res, 400, { error: 'Please send a valid conversation.' });
  const messages = body.messages
    .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.trim())
    .map(item => ({ role: item.role, content: item.content.slice(0, 12_000) }));
  if (!messages.length || messages.at(-1).role !== 'user') return json(res, 400, { error: 'Your latest message should be from you.' });

  let response;
  try {
    const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'You are a friendly, casual chatbot. The user can ask you anything. Be helpful and natural, and do not sound overly formal. Keep simple answers short.' }, ...messages],
        temperature: 0.7
      })
    });
  } catch { return json(res, 502, { error: 'Could not reach the AI provider. Check your connection and provider URL.' }); }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json(res, response.status, { error: result?.error?.message || 'The AI provider returned an error. Check your API key and model.' });
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) return json(res, 502, { error: 'The AI provider returned an empty reply.' });
  return json(res, 200, { reply });
}

await loadEnv();
const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, { configured: Boolean(process.env.AI_API_KEY) });
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    try { return await handleChat(req, res); }
    catch (error) { return json(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' }); }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'API route not found.' });
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
  let pathname;
  try { pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname); }
  catch { return json(res, 400, { error: 'Invalid URL path.' }); }
  const path = resolve(publicDir, `.${pathname}`);
  if (!path.startsWith(`${publicDir}${sep}`)) return json(res, 403, { error: 'Forbidden.' });
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : data);
  } catch { return json(res, 404, { error: 'Not found.' }); }
}).listen(port, () => console.log(`Little Chat is running at http://localhost:${port}`));
