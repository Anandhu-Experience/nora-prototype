import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { connect } from "node:tls";

//#region server/siteAudit.ts
function isPrivateIp(ip) {
	const v = ip.toLowerCase();
	if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
	if (isIP(v) === 4) {
		const [a, b] = v.split(".").map(Number);
		return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a >= 224;
	}
	if (isIP(v) === 6) return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
	return true;
}
var AuditError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.code = code;
	}
};
const defaultLookup = async (host) => (await lookup(host, { all: true })).map((a) => a.address);
/** Throws unless the URL is plain http(s) to a public host. Returns the parsed URL. */
async function assertPublicUrl(raw, lookup = defaultLookup) {
	let u;
	try {
		u = new URL(raw);
	} catch {
		throw new AuditError("invalid_url", "That does not look like a website address.");
	}
	if (!/^https?:$/.test(u.protocol)) throw new AuditError("invalid_url", "Only http and https addresses can be checked.");
	if (u.username || u.password) throw new AuditError("invalid_url", "Addresses with a login in them cannot be checked.");
	if (u.port && !["80", "443"].includes(u.port)) throw new AuditError("blocked_address", "Only standard web ports can be checked.");
	const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new AuditError("blocked_address", "Private and local addresses cannot be checked.");
	if (isIP(host)) {
		if (isPrivateIp(host)) throw new AuditError("blocked_address", "Private and local addresses cannot be checked.");
		return u;
	}
	let addrs;
	try {
		addrs = await lookup(host);
	} catch {
		throw new AuditError("unreachable", `We could not find ${host}. Check the address.`);
	}
	if (!addrs.length || addrs.some(isPrivateIp)) throw new AuditError("blocked_address", "Private and local addresses cannot be checked.");
	return u;
}
const MAX_BYTES = 15e5;
const UA = "NoraSiteAudit/1.0 (+read-only SEO check)";
async function readCapped(res, max) {
	const reader = res.body?.getReader();
	if (!reader) return await res.text();
	const chunks = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > max) {
			reader.cancel();
			throw new AuditError("too_large", "The page is too large to check.");
		}
		chunks.push(value);
	}
	return new TextDecoder().decode(Buffer.concat(chunks));
}
/** GET with manual redirects (at most 4), checking every hop. */
async function fetchPage(url, deps, timeoutMs = 9e3) {
	let current = url;
	for (let hop = 0; hop < 5; hop++) {
		const u = await assertPublicUrl(current, deps.lookup);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await deps.fetchImpl(u, {
				redirect: "manual",
				signal: controller.signal,
				headers: {
					"User-Agent": UA,
					Accept: "text/html,application/xhtml+xml"
				}
			});
			if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
				current = new URL(res.headers.get("location"), u).toString();
				continue;
			}
			if (!res.ok) throw new AuditError("unreachable", `The site answered with an error (${res.status}).`);
			if (!/html/i.test(res.headers.get("content-type") ?? "text/html")) throw new AuditError("not_html", "That address is not a web page.");
			return {
				html: await readCapped(res, MAX_BYTES),
				finalUrl: u.toString()
			};
		} catch (e) {
			if (e instanceof AuditError) throw e;
			throw new AuditError("unreachable", e?.name === "AbortError" ? "The site took too long to answer." : "We could not reach the site.");
		} finally {
			clearTimeout(timer);
		}
	}
	throw new AuditError("unreachable", "The site redirected too many times.");
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
function attrs(tag) {
	const out = {};
	for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
	return out;
}
function parseHtml(html) {
	const head = html.slice(0, 2e5);
	const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
	const named = (n) => metas.find((m) => m.name?.toLowerCase() === n)?.content ?? "";
	const og = metas.filter((m) => m.property?.toLowerCase().startsWith("og:")).map((m) => m.property.toLowerCase());
	const charset = metas.find((m) => m.charset)?.charset ?? /charset=([\w-]+)/i.exec(metas.find((m) => m["http-equiv"]?.toLowerCase() === "content-type")?.content ?? "")?.[1] ?? "";
	let reviews = {
		count: 0,
		present: false
	};
	for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) try {
		const walk = (n) => {
			if (Array.isArray(n)) return n.forEach(walk);
			if (!n || typeof n !== "object") return;
			const o = n;
			const agg = o.aggregateRating;
			if (agg) reviews = {
				present: true,
				count: Math.max(reviews.count, Number(agg.reviewCount ?? agg.ratingCount ?? 0) || 0)
			};
			Object.values(o).forEach(walk);
		};
		walk(JSON.parse(m[1]));
	} catch {}
	const text = decode(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "));
	return {
		title: decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? ""),
		description: decode(named("description")),
		robots: decode(named("robots")),
		language: /<html[^>]*\blang\s*=\s*["']([^"']+)/i.exec(head)?.[1] ?? "",
		charset,
		og: [...new Set(og)].join(", "),
		google: decode(named("google-site-verification")) ? "google-site-verification" : "",
		twitter: decode(named("twitter:card")),
		schemaReviews: reviews,
		widget: /experience\.com|review-widget|reviews?-badge|data-reviews/i.test(html),
		text
	};
}
/** Does the page mention the agent's name, phone number and address? (A plain text match.) */
function matchNap(text, nap = {}) {
	const lower = text.toLowerCase();
	const name = (nap.name ?? "").replace(/^agent\s+/i, "").trim().toLowerCase();
	const digits = (nap.phone ?? "").replace(/\D/g, "");
	const tail = digits.length >= 7 ? digits.slice(-9) : "";
	return {
		name: !!name && lower.includes(name),
		phone: !!tail && text.replace(/\D/g, "").includes(tail),
		address: !!(nap.address ?? "").trim() && lower.includes(nap.address.trim().toLowerCase())
	};
}
const defaultTlsCheck = (host) => new Promise((resolve) => {
	const done = (v) => {
		try {
			socket.destroy();
		} catch {}
		resolve(v);
	};
	const socket = connect({
		host,
		port: 443,
		servername: host,
		rejectUnauthorized: false,
		timeout: 6e3
	}, () => {
		const cert = socket.getPeerCertificate();
		const until = cert?.valid_to ? new Date(cert.valid_to) : null;
		done({
			ssl: socket.authorized && !!until && until.getTime() > Date.now(),
			expires: until && !Number.isNaN(until.getTime()) ? until.toISOString().slice(0, 10) : ""
		});
	});
	socket.on("error", () => done({
		ssl: false,
		expires: ""
	}));
	socket.on("timeout", () => done({
		ssl: false,
		expires: ""
	}));
});
async function httpsRedirects(host, deps) {
	try {
		const u = await assertPublicUrl(`http://${host}/`, deps.lookup);
		const res = await deps.fetchImpl(u, {
			redirect: "manual",
			headers: { "User-Agent": UA },
			signal: AbortSignal.timeout(6e3)
		});
		return res.status >= 300 && res.status < 400 && /^https:\/\//i.test(res.headers.get("location") ?? "");
	} catch {
		return false;
	}
}
async function pageSpeed(url, key, fetchImpl) {
	const q = new URLSearchParams({
		url,
		strategy: "mobile"
	});
	q.append("category", "seo");
	q.append("category", "performance");
	if (key) q.set("key", key);
	const res = await fetchImpl(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(7e4) });
	if (!res.ok) throw new Error(`PageSpeed Insights answered ${res.status}`);
	const lh = (await res.json()).lighthouseResult;
	if (!lh) throw new Error("PageSpeed Insights returned no result");
	const lcp = lh.audits?.["largest-contentful-paint"]?.numericValue;
	const seoAudits = Object.entries(lh.audits ?? {}).filter(([, a]) => a.scoreDisplayMode === "binary" && a.score === 0);
	const seoIds = /* @__PURE__ */ new Set([
		"document-title",
		"meta-description",
		"http-status-code",
		"link-text",
		"crawlable-anchors",
		"is-crawlable",
		"robots-txt",
		"image-alt",
		"hreflang",
		"canonical",
		"viewport",
		"html-has-lang",
		"font-size",
		"tap-targets"
	]);
	return {
		seconds: typeof lcp === "number" ? Math.round(lcp / 100) / 10 : null,
		seo: lh.categories?.seo?.score != null ? Math.round(lh.categories.seo.score * 100) : null,
		performance: lh.categories?.performance?.score != null ? Math.round(lh.categories.performance.score * 100) : null,
		issues: seoAudits.filter(([id]) => seoIds.has(id)).map(([id, a]) => ({
			id,
			title: a.title ?? id
		})).slice(0, 8)
	};
}
function createSiteAuditHandler(deps = {}) {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const lookup = deps.lookup ?? defaultLookup;
	const tlsCheck = deps.tlsCheck ?? defaultTlsCheck;
	const env = deps.env ?? process.env;
	const now = deps.now ?? Date.now;
	const { max, windowMs } = deps.limit ?? {
		max: 6,
		windowMs: 6e4
	};
	const hits = [];
	return async function handle(body) {
		const o = typeof body === "object" && body !== null ? body : null;
		if (!o || typeof o.url !== "string" || o.url.length > 2e3) return {
			status: 400,
			body: {
				error: "invalid_url",
				message: "Send a website address."
			}
		};
		const napIn = typeof o.nap === "object" && o.nap !== null ? o.nap : {};
		const s = (v, n) => typeof v === "string" ? v.slice(0, n) : void 0;
		const nap = {
			name: s(napIn.name, 120),
			phone: s(napIn.phone, 40),
			address: s(napIn.address, 160)
		};
		const t = now();
		while (hits.length && t - hits[0] > windowMs) hits.shift();
		if (hits.length >= max) return {
			status: 429,
			body: {
				error: "rate_limited",
				message: "Too many scans. Try again in a minute."
			}
		};
		hits.push(t);
		const d = {
			fetchImpl,
			lookup
		};
		try {
			const { html, finalUrl } = await fetchPage(o.url, d);
			const host = new URL(finalUrl).hostname;
			const notes = [];
			const [tls, redirect, psi] = await Promise.all([
				finalUrl.startsWith("https:") ? tlsCheck(host) : Promise.resolve({
					ssl: false,
					expires: ""
				}),
				httpsRedirects(host, d),
				pageSpeed(finalUrl, env.PAGESPEED_API_KEY, fetchImpl).catch((e) => {
					notes.push(`Load time could not be measured: ${e.message}.`);
					return null;
				})
			]);
			const p = parseHtml(html);
			return {
				status: 200,
				body: {
					url: finalUrl,
					fetchedAt: new Date(now()).toISOString(),
					page: {
						title: p.title,
						description: p.description,
						robots: p.robots,
						language: p.language,
						charset: p.charset,
						og: p.og,
						google: p.google,
						twitter: p.twitter
					},
					nap: matchNap(p.text, nap),
					reviews: {
						widget: p.widget || p.schemaReviews.present,
						schema: p.schemaReviews.present,
						count: p.schemaReviews.count
					},
					security: {
						ssl: tls.ssl,
						expires: tls.expires,
						httpsRedirect: redirect
					},
					load: {
						seconds: psi?.seconds ?? null,
						source: psi?.seconds != null ? "pagespeed" : null
					},
					lighthouse: psi ? {
						seo: psi.seo,
						performance: psi.performance,
						issues: psi.issues
					} : null,
					notes
				}
			};
		} catch (e) {
			if (e instanceof AuditError) return {
				status: e.code === "unreachable" ? 502 : 422,
				body: {
					error: e.code,
					message: e.message
				}
			};
			return {
				status: 500,
				body: {
					error: "internal",
					message: "The scan failed."
				}
			};
		}
	};
}

//#endregion
//#region api-src/seo-audit.ts
/** Vercel function: POST /api/seo/audit. The same handler as the dev server, with the key from the project's environment variables. */
const handle = createSiteAuditHandler();
async function handler(req, res) {
	const send = (status, body) => {
		res.statusCode = status;
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Cache-Control", "no-store");
		res.end(JSON.stringify(body));
	};
	if (req.method !== "POST") return send(405, { error: "method_not_allowed" });
	let body = req.body;
	if (typeof body === "string") try {
		body = JSON.parse(body);
	} catch {
		return send(400, { error: "bad_json" });
	}
	if (body === void 0) {
		let raw = "";
		for await (const chunk of req) {
			raw += chunk;
			if (raw.length > 8192) return send(413, { error: "too_large" });
		}
		try {
			body = JSON.parse(raw);
		} catch {
			return send(400, { error: "bad_json" });
		}
	}
	const out = await handle(body);
	send(out.status, out.body);
}

//#endregion
export { handler as default };