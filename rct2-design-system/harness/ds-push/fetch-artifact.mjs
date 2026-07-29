#!/usr/bin/env node
/**
 * fetch-artifact.mjs — pull one file out of a Magic Patterns ARTIFACT and write
 * it to disk, over the wire.
 *
 * WHY THIS EXISTS. Grading a generated wave means getting the park's source into
 * `harness/park-eval/samples/`. Reading it through the MCP tool puts ~40 KB of
 * TSX into the model's context and then requires the model to RE-EMIT every byte
 * through a Write call — the exact output-token cost `push.mjs` was written to
 * avoid, paid in the opposite direction. `fs.writeFileSync` <- HTTP POST instead.
 *
 * Same transport and same credentials as push.mjs: streamable-HTTP MCP
 * (JSON-RPC 2.0 over POST, SSE-framed), `MAGICPATTERNS_API_KEY` from the
 * environment and nowhere else, never logged.
 *
 * USAGE
 *   node fetch-artifact.mjs <artifactId> <fileName> <outPath>
 *   node fetch-artifact.mjs 8eee052c-… App.tsx ../park-eval/samples/w28b.tsx
 */
import fs from 'node:fs';
import path from 'node:path';

const MCP_URL = process.env.MAGICPATTERNS_MCP_URL || 'https://mcp.magicpatterns.com/mcp';
const KEY = process.env.MAGICPATTERNS_API_KEY;
const [artifactId, fileName, outPath] = process.argv.slice(2);

if (!artifactId || !fileName || !outPath) {
  console.error('usage: node fetch-artifact.mjs <artifactId> <fileName> <outPath>');
  process.exit(2);
}
if (!KEY) {
  console.error('MAGICPATTERNS_API_KEY is not set (it lives in ~/.zshenv, never in the repo).');
  process.exit(2);
}

let sessionId = null;
let nextId = 1;

/** one JSON-RPC round trip; the server answers either JSON or an SSE frame */
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
  // SSE framing: one or more `data: {…}` lines
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
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'fetch-artifact', version: '1.0.0' },
  },
});
await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, { expectResponse: false });

const result = await rpc({
  jsonrpc: '2.0', id: nextId++, method: 'tools/call',
  params: { name: 'read_artifact_files', arguments: { artifactId, fileNames: [fileName] } },
});

// the tool returns its payload as a JSON string in content[0].text
const raw = result?.content?.[0]?.text ?? '';
let parsed;
try { parsed = JSON.parse(raw); } catch { throw new Error(`unparseable tool result: ${raw.slice(0, 300)}`); }
const hit = (parsed.files || []).find((f) => f.name === fileName) || (parsed.files || [])[0];
if (!hit) throw new Error(`artifact ${artifactId} has no file "${fileName}"`);

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, hit.content);
console.log(`wrote ${Buffer.byteLength(hit.content)} B -> ${outPath}  (${hit.name})`);
