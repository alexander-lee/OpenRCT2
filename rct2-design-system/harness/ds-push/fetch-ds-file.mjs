#!/usr/bin/env node
/**
 * fetch-ds-file.mjs — pull one file out of the published DESIGN SYSTEM back to disk.
 *
 * The sibling of `fetch-artifact.mjs`, and the recovery path when a local edit goes
 * wrong: `mp3d/` is untracked, so `git checkout` cannot undo a bad rewrite, but the
 * last pushed copy is always on the server. Over the wire, so it costs no model
 * output tokens.
 *
 *   node fetch-ds-file.mjs rules/park-generation-skeletons.md ../../mp3d/rules/park-generation-skeletons.md
 */
import fs from 'node:fs';
import path from 'node:path';

const MCP_URL = process.env.MAGICPATTERNS_MCP_URL || 'https://mcp.magicpatterns.com/mcp';
const KEY = process.env.MAGICPATTERNS_API_KEY;
const DS = process.env.MAGICPATTERNS_DS_ID || 'ds-fbd20bf8-b16d-4cf1-8440-d20bc095fc4a';
const [fileName, outPath] = process.argv.slice(2);

if (!fileName || !outPath) {
  console.error('usage: node fetch-ds-file.mjs <designSystemPath> <outPath>');
  process.exit(2);
}
if (!KEY) {
  console.error('MAGICPATTERNS_API_KEY is not set (it lives in ~/.zshenv, never in the repo).');
  process.exit(2);
}

let sessionId = null;
let nextId = 1;

async function rpc(body, { expectResponse = true } = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${KEY}`,
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  if (!expectResponse) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const payloads = text.startsWith('event:') || text.startsWith('data:')
    ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim())
    : [text];
  for (const p of payloads) {
    if (!p) continue;
    const msg = JSON.parse(p);
    if (msg.error) throw new Error(`RPC error: ${JSON.stringify(msg.error).slice(0, 300)}`);
    if (msg.result !== undefined) return msg.result;
  }
  throw new Error(`no result in response: ${text.slice(0, 300)}`);
}

await rpc({
  jsonrpc: '2.0', id: nextId++, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fetch-ds-file', version: '1.0.0' } },
});
await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, { expectResponse: false });

const result = await rpc({
  jsonrpc: '2.0', id: nextId++, method: 'tools/call',
  params: { name: 'read_design_system_files', arguments: { designSystemId: DS, fileNames: [fileName] } },
});

const raw = result?.content?.[0]?.text ?? '';
let parsed;
try { parsed = JSON.parse(raw); } catch { throw new Error(`unparseable tool result: ${raw.slice(0, 300)}`); }
const hit = (parsed.files || []).find((f) => f.name === fileName) || (parsed.files || [])[0];
if (!hit) throw new Error(`design system has no file "${fileName}"`);

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, hit.content);
console.log(`restored ${Buffer.byteLength(hit.content)} B -> ${outPath}  (${hit.name})`);
