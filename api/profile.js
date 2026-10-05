//#region src/profile/details.ts
const AMENITIES = [
	{
		id: "parking",
		label: "Free parking"
	},
	{
		id: "step-free",
		label: "Step-free access"
	},
	{
		id: "wifi",
		label: "Free Wi-Fi"
	},
	{
		id: "private-room",
		label: "Private meeting room"
	},
	{
		id: "evenings",
		label: "Evening appointments"
	},
	{
		id: "virtual",
		label: "Video meetings"
	},
	{
		id: "transit",
		label: "Near public transport"
	},
	{
		id: "home-visits",
		label: "Home visits"
	}
];
const amenityLabel = (id) => AMENITIES.find((a) => a.id === id)?.label ?? id;
/** The agent's addresses; the first is the primary one. Profiles saved before addresses existed get one derived from `location`. */
function agentAddresses(a) {
	if (a.addresses?.length) return a.addresses;
	const region = a.location.includes(",") ? a.location.split(",").slice(1).join(",").trim() : "";
	return [{
		id: "addr-primary",
		label: "Main office",
		street: "",
		city: a.city,
		region,
		postal: "",
		amenities: []
	}];
}
const CITY_GEO = {
	birmingham: [52.4862, -1.8904],
	solihull: [52.4118, -1.7776],
	london: [51.5072, -.1276],
	manchester: [53.4808, -2.2426],
	leeds: [53.8008, -1.5491],
	coventry: [52.4068, -1.5197],
	bristol: [51.4545, -2.5879],
	liverpool: [53.4084, -2.9916]
};
const hash = (s) => {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
};
/** A stable, made-up position near the city centre: enough to place a pin on the demo map without a geocoder. */
function geoFor(x) {
	const [lat0, lng0] = CITY_GEO[x.city.trim().toLowerCase()] ?? [51 + hash(x.city) % 400 / 100, -3 + hash(x.city + "x") % 300 / 100];
	const h = hash(`${x.street}|${x.postal}|${x.city}`);
	const dx = (h % 1e3 / 1e3 - .5) * .04;
	return {
		lat: +(lat0 + ((h >> 10) % 1e3 / 1e3 - .5) * .03).toFixed(4),
		lng: +(lng0 + dx).toFixed(4),
		x: .2 + h % 1e3 / 1e3 * .6,
		y: .25 + (h >> 10) % 1e3 / 1e3 * .5
	};
}
const DAY_NAMES = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday"
];
const DAY_SHORT = DAY_NAMES.map((d) => d.slice(0, 3));
const defaultHours = () => ({
	timeZone: "Europe/London",
	days: [
		...Array.from({ length: 5 }, () => ({
			open: true,
			from: "09:00",
			to: "17:30"
		})),
		{
			open: true,
			from: "10:00",
			to: "14:00"
		},
		{
			open: false,
			from: "10:00",
			to: "14:00"
		}
	]
});
const agentHours = (a) => a.hours ?? defaultHours();
const DAY_URL = DAY_NAMES;
/** JSON-LD for the public profile and the rank page, built from the same data as everything else. */
function buildSchema(a, origin = "") {
	const url = `${origin}/profile/${a.id}`;
	const addr = agentAddresses(a)[0];
	const h = agentHours(a);
	const postal = {
		"@type": "PostalAddress",
		streetAddress: addr.street || void 0,
		addressLocality: addr.city,
		addressRegion: addr.region || void 0,
		postalCode: addr.postal || void 0
	};
	const ratings = a.reviews.length ? {
		"@type": "AggregateRating",
		ratingValue: +(a.reviews.reduce((n, r) => n + r.rating, 0) / a.reviews.length).toFixed(2),
		reviewCount: a.reviews.length,
		bestRating: 5,
		worstRating: 1
	} : void 0;
	const sameAs = [
		a.social.linkedin,
		a.social.twitter,
		a.social.facebook,
		a.social.website
	].filter(Boolean);
	const specs = [];
	h.days.forEach((d, i) => {
		if (!d.open) return;
		const s = specs.find((x) => x.opens === d.from && x.closes === d.to);
		if (s) s.dayOfWeek.push(DAY_URL[i]);
		else specs.push({
			dayOfWeek: [DAY_URL[i]],
			opens: d.from,
			closes: d.to
		});
	});
	const photo = a.photoUrl.startsWith("http") ? a.photoUrl : void 0;
	const g = geoFor(addr);
	return JSON.parse(JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [{
			"@type": "Person",
			"@id": `${url}#person`,
			name: a.name,
			jobTitle: a.title,
			url,
			image: photo,
			telephone: a.phone || void 0,
			email: a.email || void 0,
			description: a.about || void 0,
			sameAs: sameAs.length ? sameAs : void 0,
			knowsAbout: a.specialties,
			worksFor: {
				"@type": "Organization",
				name: a.company
			},
			award: a.awards.map((x) => `${x.title} (${x.year})`),
			address: postal,
			aggregateRating: ratings,
			review: a.reviews.slice(0, 3).map((r) => ({
				"@type": "Review",
				author: {
					"@type": "Person",
					name: r.author
				},
				reviewRating: {
					"@type": "Rating",
					ratingValue: r.rating
				},
				reviewBody: r.text,
				datePublished: r.date.slice(0, 10)
			}))
		}, {
			"@type": ["FinancialService", "LocalBusiness"],
			"@id": `${url}#business`,
			name: `${a.name} | ${a.company}`,
			url,
			telephone: a.phone || void 0,
			address: postal,
			geo: {
				"@type": "GeoCoordinates",
				latitude: g.lat,
				longitude: g.lng
			},
			openingHoursSpecification: specs.map((s) => ({
				"@type": "OpeningHoursSpecification",
				...s
			})),
			areaServed: a.serviceAreas.map((c) => ({
				"@type": "City",
				name: c
			})),
			amenityFeature: addr.amenities.map((id) => ({
				"@type": "LocationFeatureSpecification",
				name: amenityLabel(id),
				value: true
			})),
			aggregateRating: ratings,
			employee: { "@id": `${url}#person` }
		}]
	}));
}

//#endregion
//#region src/profile/seed.ts
const svc = (id, name, blurb, description, icon) => ({
	id,
	name,
	blurb,
	description,
	icon
});
const rev = (id, author, rating, date, text, reply, source) => ({
	id,
	author,
	rating,
	date,
	text,
	reply,
	source
});
const award = (id, title, issuer, year) => ({
	id,
	title,
	issuer,
	year
});
const act = (id, at, type, text) => ({
	id,
	at,
	type,
	text
});
const avatarSvg = (from, to, letter) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="78" font-family="Arial,sans-serif" font-size="56" font-weight="700" fill="white" text-anchor="middle">${letter}</text></svg>`)}`;
const noSocial = {
	linkedin: "",
	twitter: "",
	facebook: "",
	website: ""
};
const arjunan = {
	id: "arjunan",
	name: "Matt Reeves",
	title: "Mortgage Loan Officer",
	nmls: "1234567",
	company: "New American Funding",
	location: "Birmingham, UK",
	city: "Birmingham",
	photoUrl: avatarSvg("#34d399", "#15803d", "A"),
	cover: "sunset",
	pro: true,
	published: true,
	serviceAreas: ["Birmingham", "Solihull"],
	about: "Dedicated mortgage loan officer with 8+ years of experience helping clients achieve their homeownership goals. Specialize in home loans, refinancing, and first-time buyer programs. I take the time to explain every option, compare lenders on your behalf, and stay with you from pre-approval to the day you get your keys.",
	specialties: [
		"Home Loans",
		"Refinance",
		"First-time Buyers"
	],
	services: [
		svc("s1", "Home Loans", "Purchase mortgages tailored to you", "Fixed, variable and tracker mortgages for home purchases, compared across a wide panel of lenders. Includes affordability assessment and full pre-approval support.", "home"),
		svc("s2", "Refinance", "Lower your rate or release equity", "Review your current deal, model the savings and handle the paperwork to switch lender or product, or release equity for home improvements.", "calculator"),
		svc("s3", "First-time Buyers", "Guidance from deposit to keys", "Step-by-step support for first-time buyers: government schemes, deposit planning, and a clear timeline so there are no surprises.", "key")
	],
	awards: [
		award("a1", "Top Rated Agent", "Experience.com", 2024),
		award("a2", "Million Dollar Producer", "New American Funding", 2023),
		award("a3", "5-Star Service Award", "Midlands Mortgage Network", 2023)
	],
	activity: [
		act("x1", "2024-01-12", "review", "Received a 5-star review from John Doe"),
		act("x2", "2024-01-05", "loan", "Closed a first-time buyer loan in Solihull"),
		act("x3", "2023-12-18", "award", "Awarded 5-Star Service by Midlands Mortgage Network"),
		act("x4", "2023-11-30", "profile", "Added \"Refinance\" to services")
	],
	reviews: [
		rev("r1", "John Doe", 5, "2024-01-12", "Excellent service and great communication throughout the process. Highly recommended!", void 0, "Google"),
		rev("r2", "Sarah Mitchell", 5, "2023-11-03", "Matt found us a rate well below what our bank offered and was always quick to reply. Made buying our first home stress-free.", "Thank you Sarah, congratulations on the new home!", "Facebook"),
		rev("r3", "Tom Baker", 4, "2023-09-21", "Very knowledgeable and professional. The refinance took a little longer than expected but the result was great.")
	],
	yearsExperience: 8,
	completedLoans: 250,
	responseRate: 98,
	responseTime: "1 hour",
	phone: "+44 121 555 0142",
	email: "matt.reeves@newamerican.example",
	social: {
		linkedin: "https://linkedin.com/in/matt-reeves",
		twitter: "https://x.com/mattreeves",
		facebook: "",
		website: "https://mattreeves.example.com"
	},
	addresses: [{
		id: "addr1",
		label: "Main office",
		street: "45 Colmore Row",
		city: "Birmingham",
		region: "UK",
		postal: "B3 2BH",
		amenities: [
			"parking",
			"step-free",
			"private-room",
			"wifi",
			"transit"
		]
	}, {
		id: "addr2",
		label: "Solihull branch",
		street: "12 Poplar Road",
		city: "Solihull",
		region: "UK",
		postal: "B91 3AE",
		amenities: [
			"parking",
			"evenings",
			"home-visits"
		]
	}],
	hours: {
		timeZone: "Europe/London",
		days: [
			{
				open: true,
				from: "09:00",
				to: "17:30"
			},
			{
				open: true,
				from: "09:00",
				to: "17:30"
			},
			{
				open: true,
				from: "09:00",
				to: "19:00"
			},
			{
				open: true,
				from: "09:00",
				to: "17:30"
			},
			{
				open: true,
				from: "09:00",
				to: "17:00"
			},
			{
				open: true,
				from: "10:00",
				to: "14:00"
			},
			{
				open: false,
				from: "10:00",
				to: "14:00"
			}
		]
	},
	lockedFields: ["nmls", "company"],
	rankFormat: "card"
};
const priya = {
	id: "priya-nair",
	name: "Priya Nair",
	title: "Mortgage Broker",
	nmls: "2234510",
	company: "Northern Home Finance",
	location: "Manchester, UK",
	city: "Manchester",
	photoUrl: "",
	cover: "ocean",
	pro: true,
	serviceAreas: [
		"Manchester",
		"Salford",
		"Stockport"
	],
	about: "Independent broker with 11 years helping self-employed clients and landlords secure the right mortgage. Whole-of-market advice with a personal touch.",
	specialties: [
		"Buy-to-let",
		"Remortgage",
		"Self-employed"
	],
	services: [
		svc("s1", "Buy-to-let", "Finance for landlords", "Portfolio and single-property buy-to-let mortgages, including limited company structures.", "briefcase"),
		svc("s2", "Remortgage", "Switch to a better deal", "Timely reviews of your deal and a smooth switch when your fixed term ends.", "calculator"),
		svc("s3", "Self-employed", "Mortgages without the hassle", "Lenders who understand contractor and sole-trader income.", "shield")
	],
	awards: [award("a1", "Broker of the Year", "Northern Finance Awards", 2023)],
	activity: [act("x1", "2024-01-09", "loan", "Completed a buy-to-let purchase in Salford")],
	reviews: [
		rev("r1", "Amir Khan", 5, "2024-01-02", "Priya sorted my buy-to-let in record time."),
		rev("r2", "Helen Ward", 5, "2023-10-14", "Clear advice, no jargon, and she chased the lender for us."),
		rev("r3", "Pete Collins", 5, "2023-08-30", "Brilliant with self-employed paperwork."),
		rev("r4", "Lucy Grant", 4, "2023-06-11", "Great service overall.")
	],
	yearsExperience: 11,
	completedLoans: 410,
	responseRate: 96,
	responseTime: "2 hours",
	phone: "+44 161 555 0177",
	email: "priya@northernhome.example",
	social: noSocial
};
const daniel = {
	id: "daniel-okafor",
	name: "Daniel Okafor",
	title: "Loan Officer",
	nmls: "3345621",
	company: "Pennine Lending",
	location: "Leeds, UK",
	city: "Leeds",
	photoUrl: "",
	cover: "forest",
	pro: false,
	serviceAreas: ["Leeds"],
	about: "Loan officer focused on first-time buyers and shared ownership across West Yorkshire.",
	specialties: ["First-time Buyers", "Shared Ownership"],
	services: [svc("s1", "First-time Buyers", "Start your journey", "Deposit planning and mortgage guidance for first-time buyers.", "key"), svc("s2", "Shared Ownership", "Buy a share of your home", "Specialist advice on shared ownership mortgages.", "home")],
	awards: [],
	activity: [act("x1", "2023-12-04", "profile", "Joined Experience.com")],
	reviews: [rev("r1", "Grace Ibe", 5, "2023-12-20", "Daniel made shared ownership understandable."), rev("r2", "Joe Platt", 4, "2023-10-02", "Helpful and patient.")],
	yearsExperience: 5,
	completedLoans: 120,
	responseRate: 92,
	responseTime: "3 hours",
	phone: "+44 113 555 0119",
	email: "daniel@pennine.example",
	social: noSocial
};
const sofia = {
	id: "sofia-marin",
	name: "Sofia Marin",
	title: "Mortgage Advisor",
	nmls: "4456732",
	company: "Capital Home Loans",
	location: "London, UK",
	city: "London",
	photoUrl: "",
	cover: "dusk",
	pro: true,
	serviceAreas: [
		"London",
		"Surrey",
		"Kent"
	],
	about: "London-based advisor with 14 years in jumbo, investor and refinance lending. Known for fast turnarounds on complex cases.",
	specialties: [
		"Jumbo Loans",
		"Refinance",
		"Investors"
	],
	services: [
		svc("s1", "Jumbo Loans", "High-value property finance", "Large-loan mortgages with private bank and specialist lender access.", "briefcase"),
		svc("s2", "Refinance", "Optimise your borrowing", "Restructure existing debt and release equity.", "calculator"),
		svc("s3", "Investor Finance", "Grow your portfolio", "Finance structures for investors and developers.", "chart")
	],
	awards: [award("a1", "Top 50 Advisors", "UK Mortgage Review", 2024), award("a2", "Million Dollar Producer", "Capital Home Loans", 2023)],
	activity: [act("x1", "2024-01-10", "award", "Named in the Top 50 Advisors")],
	reviews: [
		rev("r1", "Oliver Hale", 5, "2024-01-06", "Complex case, handled flawlessly."),
		rev("r2", "Nadia Rao", 5, "2023-11-22", "Fast and clear."),
		rev("r3", "Ben Cross", 4, "2023-09-15", "Very sharp advisor."),
		rev("r4", "Ella Fox", 5, "2023-07-01", "Highly recommend."),
		rev("r5", "Raj Patel", 5, "2023-05-19", "Excellent on refinancing.")
	],
	yearsExperience: 14,
	completedLoans: 600,
	responseRate: 99,
	responseTime: "30 minutes",
	phone: "+44 20 5550 0188",
	email: "sofia@capitalhome.example",
	social: noSocial
};
const marcus = {
	id: "marcus-lee",
	name: "Marcus Lee",
	title: "Home Loan Specialist",
	nmls: "5567843",
	company: "New American Funding",
	location: "Birmingham, UK",
	city: "Birmingham",
	photoUrl: "",
	cover: "slate",
	pro: false,
	serviceAreas: ["Birmingham"],
	about: "Newer to the industry and keen to help young families get on the ladder.",
	specialties: ["Home Loans", "Family Mortgages"],
	services: [svc("s1", "Home Loans", "Mortgages for families", "Straightforward purchase mortgages for families.", "home")],
	awards: [],
	activity: [act("x1", "2023-11-12", "profile", "Joined Experience.com")],
	reviews: [rev("r1", "Kim Walsh", 4, "2023-12-01", "Friendly and helpful.")],
	yearsExperience: 3,
	completedLoans: 60,
	responseRate: 90,
	responseTime: "1 day",
	phone: "+44 121 555 0166",
	email: "marcus@newamerican.example",
	social: noSocial
};
function seedState() {
	const agents = [
		arjunan,
		priya,
		daniel,
		sofia,
		marcus
	];
	return structuredClone({
		viewerId: "arjunan",
		agents: Object.fromEntries(agents.map((a) => [a.id, a])),
		order: agents.map((a) => a.id),
		threads: [{
			id: "t-sofia",
			withName: "Sofia Marin",
			withAgentId: "sofia-marin",
			unread: true,
			messages: [{
				id: "m1",
				from: "them",
				at: "2024-01-14T09:30:00Z",
				text: "Hi Matt, do you handle first-time buyer referrals in Birmingham? I have a client moving up from London."
			}]
		}, {
			id: "t-priya",
			withName: "Priya Nair",
			withAgentId: "priya-nair",
			unread: false,
			messages: [{
				id: "m1",
				from: "me",
				at: "2024-01-08T14:00:00Z",
				text: "Hi Priya, could you take a buy-to-let enquiry from one of my clients?"
			}, {
				id: "m2",
				from: "them",
				at: "2024-01-08T15:10:00Z",
				text: "Absolutely, send them over. I can speak to them tomorrow."
			}]
		}],
		notifications: [{
			id: "n1",
			text: "Sofia Marin sent you a message",
			at: "2024-01-14T09:30:00Z",
			read: false,
			link: "/messages"
		}, {
			id: "n2",
			text: "Your profile was viewed 42 times this week",
			at: "2024-01-13T08:00:00Z",
			read: false,
			link: "/insights"
		}],
		reports: []
	});
}

//#endregion
//#region server/profilePage.ts
/**
* Server-rendered head and first paint for a public profile, so search engines and AI crawlers that do not run JavaScript
* see a real title, description, canonical, Open Graph and Twitter tags, schema.org JSON-LD and the profile text.
* It uses the seeded agents (the app's data is demo data); changes made in a visitor's browser are not reflected here.
*/
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;"
})[c]);
const cut = (s, n) => s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
const seededAgent = (id) => seedState().agents[id];
function profileMeta(a, origin) {
	const city = agentAddresses(a)[0].city;
	return {
		title: `${a.name} | ${a.title} in ${city}`,
		description: cut(a.about.replace(/\s+/g, " ").trim() || `${a.name}, ${a.title} at ${a.company} in ${city}.`, 155),
		canonical: `${origin}/profile/${a.id}`
	};
}
/** The profile as plain, crawlable HTML. React replaces it when the app starts. */
function bodyHtml(a) {
	const addr = agentAddresses(a)[0];
	const rating = a.reviews.length ? (a.reviews.reduce((n, r) => n + r.rating, 0) / a.reviews.length).toFixed(2) : "";
	return `<main><article><h1>${esc(a.name)}</h1><p>${esc(a.title)} at ${esc(a.company)}</p>
<p>${esc([
		addr.street,
		addr.city,
		addr.postal
	].filter(Boolean).join(", "))}</p><p>Phone: ${esc(a.phone)}</p>
${rating ? `<p>Rated ${rating} from ${a.reviews.length} reviews</p>` : ""}<h2>About</h2><p>${esc(a.about)}</p>
<h2>Services</h2><ul>${a.services.map((s) => `<li>${esc(s.name)}: ${esc(s.blurb)}</li>`).join("")}</ul>
<h2>Specialties</h2><p>${a.specialties.map(esc).join(", ")}</p></article></main>`;
}
/** Takes the built index.html and returns it with the profile's head tags, JSON-LD and text filled in. */
function renderProfileHtml(indexHtml, a, origin) {
	const m = profileMeta(a, origin);
	const noindex = a.published === false;
	const head = [
		`<meta name="description" content="${esc(m.description)}" />`,
		`<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}" />`,
		`<link rel="canonical" href="${esc(m.canonical)}" />`,
		`<meta property="og:type" content="profile" />`,
		`<meta property="og:title" content="${esc(m.title)}" />`,
		`<meta property="og:description" content="${esc(m.description)}" />`,
		`<meta property="og:url" content="${esc(m.canonical)}" />`,
		`<meta property="og:site_name" content="Experience.com" />`,
		`<meta name="twitter:card" content="summary" />`,
		`<meta name="twitter:title" content="${esc(m.title)}" />`,
		`<meta name="twitter:description" content="${esc(m.description)}" />`,
		`<script type="application/ld+json">${JSON.stringify(buildSchema(a, origin)).replace(/</g, "\\u003c")}<\/script>`
	].join("\n    ");
	return indexHtml.replace(/<html lang="[^"]*"/, "<html lang=\"en-GB\"").replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`).replace("</head>", `    ${head}\n  </head>`).replace("<div id=\"root\"></div>", `<div id="root">${bodyHtml(a)}</div>`);
}

//#endregion
//#region api-src/profile.ts
/** Vercel function behind the /profile/:id rewrite: the app's index.html with the profile's SEO tags and text filled in. */
async function handler(req, res) {
	const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim().toLowerCase();
	const proto = String(req.headers["x-forwarded-proto"] ?? "https").split(",")[0].trim() === "http" ? "http" : "https";
	const rawId = req.query?.id ?? new URL(req.url ?? "/", "http://x").searchParams.get("id") ?? "";
	const id = String(Array.isArray(rawId) ? rawId[0] : rawId);
	const fail = (status, text) => {
		res.statusCode = status;
		res.setHeader("Content-Type", "text/plain");
		res.end(text);
	};
	if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/.test(host) || /^(localhost|127\.|10\.|192\.168\.)/.test(host)) return fail(400, "Bad host");
	let indexHtml;
	try {
		const r = await fetch(`${proto}://${host}/index.html`, {
			signal: AbortSignal.timeout(8e3),
			headers: { "x-profile-render": "1" }
		});
		if (!r.ok) return fail(502, "Could not load the app shell");
		indexHtml = await r.text();
	} catch {
		return fail(502, "Could not load the app shell");
	}
	const agent = seededAgent(id);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
	res.end(agent ? renderProfileHtml(indexHtml, agent, `${proto}://${host}`) : indexHtml);
}

//#endregion
export { handler as default };