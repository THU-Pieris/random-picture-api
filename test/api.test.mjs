import assert from "node:assert/strict";
import test from "node:test";

import {
  createHandler,
  loadImageUrls,
  parseImageUrls,
  selectImage,
} from "../api/index.mjs";

const IMAGES = [
  "https://img.example/zero.webp",
  "https://img.example/one.webp",
  "https://img.example/two.webp",
];

test("parses only non-empty HTTP(S) image URLs", () => {
  assert.deepEqual(
    parseImageUrls(`\n${IMAGES[0]}\r\nnot-a-url\nfile:///tmp/private\n${IMAGES[1]}\n`),
    IMAGES.slice(0, 2),
  );
});

test("loads the repository image list", () => {
  const imageUrls = loadImageUrls();
  assert.ok(imageUrls.length > 0);
  assert.ok(imageUrls.every((url) => /^https?:\/\//u.test(url)));
});

test("accepts only a strict in-range integer id", () => {
  assert.deepEqual(selectImage(IMAGES, "2", () => 0), {
    id: 2,
    url: IMAGES[2],
    fixed: true,
  });

  for (const invalidId of ["-1", "1.5", "1e0", " 1", "3"]) {
    assert.deepEqual(selectImage(IMAGES, invalidId, () => 0.5), {
      id: 1,
      url: IMAGES[1],
      fixed: false,
    });
  }
});

test("redirects random and fixed image requests with the legacy cache contract", async () => {
  const handler = createHandler(IMAGES, () => 0.75);

  const randomResponse = await handler.fetch(
    new Request("https://pic.example/api?post=ignored"),
  );
  assert.equal(randomResponse.status, 302);
  assert.equal(randomResponse.headers.get("location"), IMAGES[2]);
  assert.equal(randomResponse.headers.get("cache-control"), "no-cache");
  assert.equal(randomResponse.headers.get("referrer-policy"), "no-referrer");

  const fixedResponse = await handler.fetch(
    new Request("https://pic.example/api?id=1"),
  );
  assert.equal(fixedResponse.status, 302);
  assert.equal(fixedResponse.headers.get("location"), IMAGES[1]);
  assert.equal(fixedResponse.headers.get("cache-control"), "public, max-age=86400");
});

test("returns JSON metadata and keeps raw output disabled", async () => {
  const handler = createHandler(IMAGES, () => 0);

  const jsonResponse = await handler.fetch(
    new Request("https://pic.example/api?id=1&json"),
  );
  assert.equal(jsonResponse.status, 200);
  assert.equal(jsonResponse.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await jsonResponse.json(), { id: 1, url: IMAGES[1] });

  const rawResponse = await handler.fetch(
    new Request("https://pic.example/api?raw"),
  );
  assert.equal(rawResponse.status, 403);
  assert.equal(await rawResponse.text(), "Raw output is disabled\n");
});

test("fails closed with a clean 503 when the image list is unavailable", async () => {
  const handler = createHandler([]);

  const response = await handler.fetch(new Request("https://pic.example/api"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "Image list unavailable\n");

  const jsonResponse = await handler.fetch(
    new Request("https://pic.example/api?json"),
  );
  assert.equal(jsonResponse.status, 503);
  assert.deepEqual(await jsonResponse.json(), {
    error: "Image list unavailable",
  });
});
