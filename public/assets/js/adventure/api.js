"use strict";

const METHODS = Object.freeze({
  bootstrap: "GET",
  discover: "GET",
  item: "GET",
  browse: "GET",
  index: "GET",
  catalog: "GET",
  identity: "POST",
  vote: "POST",
  guardian: "POST",
  "guardian-thread": "GET",
  csrf: "GET",
  "game-state": "GET",
  "game-save": "POST",
  "game-restore": "POST",
  parcels: "GET",
  parcel: "GET",
});
class ApiError extends Error {
  constructor(code, status = 0, details = null) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
function webUrl(value, base) {
  if (typeof value !== "string" || !value || value.length > 4096) return null;
  try {
    const url = new URL(value, base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== new URL(base).origin
    )
      return null;
    return url.href;
  } catch (_) {
    return null;
  }
}
/** Strict public DTO boundary. Never accepts executable markup, asset snippets or scene data. */
function piece(value, api) {
  if (
    !value ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    !["cuento", "chiste", "expresion"].includes(value.kind) ||
    value.lang !== api.locale ||
    typeof value.title !== "string" ||
    value.title.length > 300 ||
    (value.voiceId !== null &&
      (!Number.isSafeInteger(value.voiceId) || value.voiceId <= 0))
  ) {
    throw new ApiError("invalid_piece");
  }
  const url = api.url(value.url),
    audio = value.audio ? api.url(value.audio) : null;
  if (!url || (value.audio && !audio)) throw new ApiError("invalid_url");
  return {
    id: value.id,
    voiceId: value.voiceId,
    kind: value.kind,
    lang: value.lang,
    title: value.title,
    summary:
      typeof value.summary === "string" ? value.summary.slice(0, 2000) : "",
    name: typeof value.name === "string" ? value.name.slice(0, 120) : "",
    handle: typeof value.handle === "string" ? value.handle.slice(0, 120) : "",
    authorUrl: api.url(value.authorUrl),
    url,
    audio,
    duration:
      Number.isFinite(value.duration) && value.duration > 0
        ? value.duration
        : 0,
    region: typeof value.region === "string" ? value.region.slice(0, 120) : "",
    regionSlug: typeof value.regionSlug === "string" ? value.regionSlug : "",
    category: typeof value.category === "string" ? value.category : "",
    rating:
      Number.isFinite(value.rating) && value.rating >= 1 && value.rating <= 5
        ? value.rating
        : null,
  };
}
class WorldApi {
  constructor(config, session, fetcher = (...args) => fetch(...args)) {
    this.locale = config.locale;
    this.base = new URL(config.apiBase || "/api/world/", location.href);
    this.web = new URL(config.websiteBase || "/", location.href);
    for (const base of [this.base, this.web]) {
      if (
        !["http:", "https:"].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw new ApiError("invalid_api_base");
      if (!base.pathname.endsWith("/")) base.pathname += "/";
    }
    this.session = session;
    this.fetcher = fetcher;
    this.pending = new Map();
  }
  url(value) {
    return webUrl(value, this.web);
  }
  async request(endpoint, params = {}, options = {}) {
    const method = METHODS[endpoint];
    if (!method) throw new ApiError("unknown_endpoint");
    const url = new URL(endpoint, this.base);
    if (method === "GET") {
      for (const [key, value] of Object.entries({
        lang: this.locale,
        ...params,
      }))
        if (value !== undefined && value !== null && value !== "")
          url.searchParams.set(key, String(value));
    }
    const headers = { Accept: "application/json" };
    const token = options.auth ? this.session.get() : "";
    if (token) headers.Authorization = "Bearer " + token;
    if (method === "POST") headers["Content-Type"] = "application/json";
    const timeout = AbortSignal.timeout(options.timeout || 12000);
    const signal = options.signal
      ? AbortSignal.any([timeout, options.signal])
      : timeout;
    let response;
    try {
      response = await this.fetcher(url, {
        method,
        headers,
        signal,
        credentials: "include",
        ...(method === "POST" ? { body: JSON.stringify(params) } : {}),
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError("network");
    }
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new ApiError("invalid_response", response.status);
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new ApiError("invalid_response");
    if (!response.ok || data.ok === false)
      throw new ApiError(
        typeof data.error === "string" ? data.error : "unavailable",
        response.status,
        data,
      );
    if (typeof data.token === "string" && data.token)
      this.session.set(data.token);
    return data;
  }
  /** Deduplicate public catalogue reads in flight. Never caches an identity or a mutation. */
  once(endpoint, params = {}) {
    if (
      METHODS[endpoint] !== "GET" ||
      ["csrf", "guardian-thread", "game-state"].includes(endpoint)
    )
      throw new ApiError("not_public_read");
    const key = endpoint + JSON.stringify(params);
    if (!this.pending.has(key)) {
      const task = this.request(endpoint, params).finally(() =>
        this.pending.delete(key),
      );
      this.pending.set(key, task);
    }
    return this.pending.get(key);
  }
  cursor(data, previous = 0) {
    if (
      data.nextCursor !== null &&
      (!Number.isSafeInteger(data.nextCursor) ||
        data.nextCursor <= previous ||
        data.nextCursor > 10000)
    )
      throw new ApiError("invalid_cursor");
    return data.nextCursor;
  }
  pieces(data) {
    if (!Array.isArray(data.items) || data.items.length > 24)
      throw new ApiError("invalid_batch");
    return data.items.map((value) => piece(value, this));
  }
  async item(value, signal) {
    return piece(
      (
        await this.request(
          "item",
          { kind: value.kind, id: value.id, voice: value.voiceId },
          { signal },
        )
      ).item,
      this,
    );
  }
}
module.exports = { WorldApi, ApiError, webUrl, piece, METHODS };
