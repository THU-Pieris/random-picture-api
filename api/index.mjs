import { readFileSync } from "node:fs";

const IMAGE_LIST_PATH = new URL("../url.csv", import.meta.url);
const ALLOWED_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

export function parseImageUrls(csv) {
  return csv
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;

      try {
        return ALLOWED_IMAGE_PROTOCOLS.has(new URL(line).protocol);
      } catch {
        return false;
      }
    });
}

export function loadImageUrls(path = IMAGE_LIST_PATH) {
  return parseImageUrls(readFileSync(path, "utf8"));
}

export function selectImage(imageUrls, rawId, random = Math.random) {
  if (imageUrls.length === 0) return undefined;

  if (typeof rawId === "string" && /^\d+$/u.test(rawId)) {
    const id = Number(rawId);
    if (Number.isSafeInteger(id) && id < imageUrls.length) {
      return { id, url: imageUrls[id], fixed: true };
    }
  }

  const randomValue = random();
  const normalizedRandom =
    Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1
      ? randomValue
      : 0;
  const id = Math.floor(normalizedRandom * imageUrls.length);
  return { id, url: imageUrls[id], fixed: false };
}

function unavailableResponse(wantsJson) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": wantsJson
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8",
  };

  if (wantsJson) {
    return new Response(JSON.stringify({ error: "Image list unavailable" }), {
      status: 503,
      headers: {
        ...headers,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response("Image list unavailable\n", { status: 503, headers });
}

export function createHandler(imageUrls, random = Math.random) {
  const bundledImageUrls = Object.freeze([...imageUrls]);

  return {
    fetch(request) {
      const requestUrl = new URL(request.url);
      const wantsJson = requestUrl.searchParams.has("json");

      // Keep the legacy precedence: ?json&raw returns metadata, while raw-only
      // requests remain disabled.
      if (!wantsJson && requestUrl.searchParams.has("raw")) {
        return new Response("Raw output is disabled\n", {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }

      const selected = selectImage(
        bundledImageUrls,
        requestUrl.searchParams.get("id"),
        random,
      );
      if (!selected) return unavailableResponse(wantsJson);

      const cacheControl = selected.fixed
        ? "public, max-age=86400"
        : "no-cache";

      if (wantsJson) {
        return new Response(
          JSON.stringify({ id: selected.id, url: selected.url }),
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": cacheControl,
              "Content-Type": "application/json; charset=utf-8",
            },
          },
        );
      }

      return new Response(null, {
        status: 302,
        headers: {
          "Cache-Control": cacheControl,
          Location: selected.url,
          "Referrer-Policy": "no-referrer",
        },
      });
    },
  };
}

let imageUrls = [];
try {
  imageUrls = loadImageUrls();
} catch {
  // The handler returns a clean 503 below; never leak filesystem details or a
  // runtime stack trace to callers.
}

export default createHandler(imageUrls);
