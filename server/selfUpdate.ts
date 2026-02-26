import { chmodSync, renameSync, unlinkSync } from "node:fs";

/**
 * Downloads a new binary from the given asset URL and atomically replaces the
 * currently running binary. The replacement takes effect on next invocation —
 * the running process keeps its original file descriptor.
 */
export async function performSelfUpdate(assetUrl: string): Promise<void> {
  const binaryPath = process.execPath;
  const tempPath = `${binaryPath}.new`;

  try {
    const res = await fetch(assetUrl, {
      headers: { "User-Agent": "open-plan-annotator-update" },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

    const compressed = new Uint8Array(await res.arrayBuffer());
    const tarBuffer = Bun.gunzipSync(compressed);
    const binary = extractBinaryFromTar(tarBuffer);

    await Bun.write(tempPath, binary, { mode: 0o755 });
    renameSync(tempPath, binaryPath);
    chmodSync(binaryPath, 0o755);
  } catch (err) {
    // Clean up temp file if it was written
    try {
      unlinkSync(tempPath);
    } catch {
      // Temp file may not exist
    }
    throw err;
  }
}

/** Extracts the binary named "open-plan-annotator" from a tar archive buffer. */
export function extractBinaryFromTar(tarBuffer: Uint8Array): Uint8Array {
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset < tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    const name = decoder.decode(header.subarray(0, 100)).replace(/\0.*/g, "");
    const sizeStr = decoder.decode(header.subarray(124, 136)).replace(/\0.*/g, "").trim();
    const size = Number.parseInt(sizeStr, 8);

    if (!name || Number.isNaN(size)) break;

    if (name === "open-plan-annotator" || name.endsWith("/open-plan-annotator")) {
      return tarBuffer.subarray(offset, offset + size);
    }

    // Tar records are padded to 512-byte boundaries
    offset += Math.ceil(size / 512) * 512;
  }

  throw new Error("Binary 'open-plan-annotator' not found in archive");
}
