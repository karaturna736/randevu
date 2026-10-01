export class RequestBodyTooLargeError extends Error {}

// Count bytes as they arrive, including requests without Content-Length.
// Reading req.text() first lets an oversized stream consume memory before rejection.
export async function readBoundedText(req: Request, maxBytes: number) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await req.body?.cancel();
    throw new RequestBodyTooLargeError();
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
