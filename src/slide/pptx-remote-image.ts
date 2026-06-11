import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const REMOTE_PPTX_IMAGE_TIMEOUT_MS = 12_000;
const MAX_REMOTE_PPTX_IMAGE_BYTES = 25 * 1024 * 1024;

const RemotePptxImageInputSchema = z.object({
  url: z.string().url().max(4096),
});

type RemotePptxImageResult = {
  data: string | null;
  message?: string;
};

export const resolveRemotePptxImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RemotePptxImageInputSchema.parse(data))
  .handler(async ({ data }): Promise<RemotePptxImageResult> => {
    const url = new URL(data.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { data: null, message: "Only http(s) image URLs can be exported." };
    }
    if (isBlockedNetworkTarget(url.hostname)) {
      return { data: null, message: "Private network image URLs are not exported." };
    }

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      REMOTE_PPTX_IMAGE_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url.href, {
        headers: {
          accept:
            "image/avif,image/webp,image/svg+xml,image/png,image/jpeg,image/gif,*/*",
        },
        signal: abortController.signal,
      });
      if (!response.ok) {
        return {
          data: null,
          message: `Image fetch failed with HTTP ${response.status}.`,
        };
      }

      const contentLength = Number.parseInt(
        response.headers.get("content-length") ?? "0",
        10,
      );
      if (contentLength > MAX_REMOTE_PPTX_IMAGE_BYTES) {
        return { data: null, message: "Image is too large for PPTX export." };
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_REMOTE_PPTX_IMAGE_BYTES) {
        return { data: null, message: "Image is too large for PPTX export." };
      }

      const bytes = new Uint8Array(buffer);
      const contentType = resolveImageMimeType(
        url,
        response.headers.get("content-type"),
        bytes,
      );
      if (!contentType?.startsWith("image/")) {
        return { data: null, message: "Remote URL did not return an image." };
      }

      return {
        data: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`,
      };
    } catch (error) {
      return {
        data: null,
        message:
          error instanceof Error
            ? `Image fetch failed: ${error.message}`
            : "Image fetch failed.",
      };
    } finally {
      clearTimeout(timeout);
    }
  });

function resolveImageMimeType(
  url: URL,
  contentTypeHeader: string | null,
  bytes: Uint8Array,
): string | null {
  const sniffed = mimeFromBytes(bytes);
  if (sniffed) return sniffed;

  const contentType = contentTypeHeader?.split(";")[0]?.trim().toLowerCase();
  if (contentType?.startsWith("image/")) return contentType;

  return mimeFromUrl(url);
}

function mimeFromBytes(bytes: Uint8Array): string | null {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  const prefix = new TextDecoder()
    .decode(bytes.slice(0, 512))
    .trimStart()
    .toLowerCase();
  if (
    prefix.startsWith("<svg") ||
    (prefix.startsWith("<?xml") && prefix.includes("<svg"))
  ) {
    return "image/svg+xml";
  }
  return null;
}

function mimeFromUrl(url: URL): string | null {
  const direct = mimeFromPath(url.pathname);
  if (direct) return direct;

  for (const paramName of ["url", "src"]) {
    const nested = url.searchParams.get(paramName);
    if (!nested) continue;
    try {
      const nestedMime = mimeFromPath(new URL(nested).pathname);
      if (nestedMime) return nestedMime;
    } catch {
      const nestedMime = mimeFromPath(nested);
      if (nestedMime) return nestedMime;
    }
  }
  return null;
}

function mimeFromPath(pathname: string): string | null {
  const lower = pathname.toLowerCase().split(/[?#]/)[0] ?? "";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer)).toString("base64");
}

function isBlockedNetworkTarget(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }

  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}
