/** Bounded SSE reader shared by the provider and the game client. */
export async function* readSSE(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    bytes = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw Error("STREAM_LIMIT");
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        "\n",
      );
      if (buffer.length > 100_000) throw Error("STREAM_FRAME_LIMIT");
      let at;
      while ((at = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        const data = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (data) yield data;
      }
    }
    if (buffer.trim() && !buffer.trim().startsWith(":"))
      throw Error("STREAM_TRUNCATED");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export const encodeSSE = (data: unknown) =>
  new TextEncoder().encode("data: " + JSON.stringify(data) + "\n\n");
