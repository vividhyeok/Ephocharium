const CACHE = "epocharium-0.6.0";
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(["/", "/manifest.webmanifest", "/art/objects/world.svg"]),
      ),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("epocharium-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/@") ||
    url.pathname.startsWith("/src/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          (event.request.mode === "navigate" ||
            url.pathname.startsWith("/assets/") ||
            url.pathname.startsWith("/art/") ||
            url.pathname.endsWith(".webmanifest"))
        ) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then(
            (c) =>
              c ||
              (event.request.mode === "navigate"
                ? caches.match("/")
                : Response.error()),
          ),
      ),
  );
});
