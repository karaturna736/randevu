import assert from "node:assert/strict";
import { readBoundedText, RequestBodyTooLargeError } from "../lib/request-body.ts";

const encode = value => new TextEncoder().encode(value);
let checks = 0;
async function rejects(chunks, headers = {}) {
  let cancelled = false;
  let pulls = 0;
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks[pulls++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() { cancelled = true; },
  });
  const req = new Request("https://neta.test", { method: "POST", body: stream, duplex: "half", headers });
  await assert.rejects(readBoundedText(req, 16000), RequestBodyTooLargeError);
  assert.ok(cancelled, "Oversized stream is cancelled");
  assert.ok(pulls < chunks.length, "Remaining body is never consumed");
  checks++;
}

await rejects([new Uint8Array(16001), ...Array.from({ length: 20 }, () => new Uint8Array(4096))]);
await rejects([new Uint8Array(8000), new Uint8Array(8001), ...Array.from({ length: 20 }, () => new Uint8Array(4096))], { "content-length": "1" });
await rejects(Array.from({ length: 30 }, () => new Uint8Array(4096)), { "content-length": "1000000" });
await rejects([encode("ş".repeat(8001)), ...Array.from({ length: 20 }, () => encode("ş"))]);

const boundary = "a".repeat(16000);
assert.equal(await readBoundedText(new Request("https://neta.test", { method: "POST", body: boundary }), 16000), boundary);
checks++;
const value = JSON.stringify({ name: "İşletme ✂️", note: "müşteri" });
const bytes = encode(value);
// Split UTF-8 code points across chunks to exercise the streaming decoder.
const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
assert.equal(await readBoundedText(new Request("https://neta.test", { method: "POST", body: stream, duplex: "half" }), 16000), value);
checks++;
assert.equal(await readBoundedText(new Request("https://neta.test"), 16000), "");
checks++;
console.log(JSON.stringify({ passed: checks, failed: 0 }));
