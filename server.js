const express = require(‘express’);
const fetch = require(‘node-fetch’);
const app = express();

// CORS toestaan voor PhoneFlip app
app.use((req, res, next) => {
res.header(‘Access-Control-Allow-Origin’, ‘*’);
res.header(‘Access-Control-Allow-Headers’, ‘Content-Type’);
next();
});

// Echte marktwaarden NL 2026
const MARKTWAARDEN = {
‘iphone 15 pro max’: 850, ‘iphone 15 pro’: 720, ‘iphone 15’: 600,
‘iphone 14 pro max’: 750, ‘iphone 14 pro’: 620, ‘iphone 14’: 480,
‘iphone 13 pro max’: 550, ‘iphone 13 pro’: 450, ‘iphone 13’: 280,
‘iphone 12 pro max’: 280, ‘iphone 12 pro’: 240, ‘iphone 12’: 190,
‘iphone 11 pro max’: 240, ‘iphone 11 pro’: 200, ‘iphone 11’: 170,
‘iphone xr’: 140, ‘iphone se’: 130, ‘iphone x’: 120,
‘samsung galaxy s24’: 700, ‘samsung galaxy s23’: 500,
‘samsung galaxy s22’: 380, ‘samsung galaxy s21’: 280,
‘samsung galaxy s20’: 220, ‘samsung galaxy a54’: 280,
‘samsung galaxy a53’: 230, ‘samsung galaxy a52’: 180,
‘samsung galaxy a34’: 250, ‘samsung galaxy a33’: 200,
};

function getMarktwaarde(titel) {
const t = titel.toLowerCase();
for (const [model, prijs] of Object.entries(MARKTWAARDEN)) {
if (t.includes(model)) return prijs;
}
if (t.includes(‘iphone’)) return 200;
if (t.includes(‘samsung’)) return 180;
return 150;
}

// Zoektermen rouleren
const ZOEKTERMEN = [
‘iphone 13’, ‘iphone 12’, ‘iphone 11’, ‘samsung galaxy s22’,
‘iphone 14’, ‘samsung galaxy s21’, ‘iphone xr’, ‘samsung galaxy a53’,
‘iphone se’, ‘samsung galaxy s23’, ‘iphone 15’, ‘samsung galaxy a52’,
‘iphone 12 pro’, ‘samsung galaxy s20’, ‘iphone 11 pro’,
];

let zoekIndex = 0;

// Health check
app.get(’/’, (req, res) => {
res.json({ status: ‘PhoneFlip API actief’, deals_endpoint: ‘/api/deals’ });
});

// Deals endpoint
app.get(’/api/deals’, async (req, res) => {
const alleItems = [];
const gebruikteTermen = [];

// Pak 5 zoektermen roulerend
for (let i = 0; i < 5; i++) {
const term = ZOEKTERMEN[(zoekIndex + i) % ZOEKTERMEN.length];
gebruikteTermen.push(term);
try {
const items = await zoekMarktplaats(term);
alleItems.push(…items);
} catch (e) {
console.error(‘Zoekfout:’, term, e.message);
}
}

zoekIndex = (zoekIndex + 5) % ZOEKTERMEN.length;

// Verwerk en filter
const deals = alleItems
.map(verwerk)
.filter(d => d !== null)
.sort((a, b) => {
if (b.hot !== a.hot) return b.hot ? 1 : -1;
return b.winstPerc - a.winstPerc;
});

res.json({
deals,
totaal: deals.length,
zoektermen: gebruikteTermen,
timestamp: new Date().toISOString(),
});
});

async function zoekMarktplaats(query) {
const url = `https://www.marktplaats.nl/lrp/api/search?query=${encodeURIComponent(query)}&l1CategoryId=20&l2CategoryId=328&priceFrom=50&priceTo=600&limit=15&offset=0&sortBy=SORT_INDEX&sortOrder=DECREASING`;

const res = await fetch(url, {
headers: {
‘User-Agent’: ‘Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15’,
‘Accept’: ‘application/json’,
‘Accept-Language’: ‘nl-NL,nl;q=0.9’,
},
timeout: 10000,
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
return data.listings || [];
}

function verwerk(item) {
try {
const prijs = item.priceInfo?.priceCents
? Math.round(item.priceInfo.priceCents / 100) : 0;

```
if (!prijs || prijs < 50 || prijs > 600) return null;

const titel = (item.title || '').trim();
if (!titel) return null;

const titelL = titel.toLowerCase();
const desc   = (item.description || '').slice(0, 300);
const descL  = desc.toLowerCase();

// Alleen iPhone en Samsung
if (!titelL.includes('iphone') && !titelL.includes('samsung')) return null;

// iCloud lock = niet verkoopbaar
if (descL.includes('icloud') && (descL.includes('lock') || descL.includes('geblokkeerd'))) return null;

const marktwaarde = getMarktwaarde(titel);

// Alleen tonen als vraagprijs duidelijk onder marktwaarde ligt
if (prijs >= marktwaarde * 0.92) return null;

const locatie  = item.location?.cityName || 'Nederland';
const verkoper = item.sellerInformation?.displayName || 'Particulier';
const foto     = item.pictures?.[0]?.mediumUrl || null;
const url      = item.vipUrl ? `https://www.marktplaats.nl${item.vipUrl}` : 'https://www.marktplaats.nl/l/telecommunicatie/mobiele-telefoons/';

// Datum
let datum = 'Recent';
try {
  const raw = item.date;
  if (raw) {
    const d = typeof raw === 'number' ? new Date(raw) : new Date(raw);
    if (!isNaN(d.getTime())) datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
} catch (e) {}

const schadeWoorden = ['schade', 'barst', 'gebarsten', 'kapot', 'defect', 'kras', 'crack', 'broken'];
const heeftSchade   = schadeWoorden.some(w => descL.includes(w) || titelL.includes(w));

const isNieuw = descL.includes('nieuw') || descL.includes('sealed');
const soort   = heeftSchade ? 'schade' : isNieuw ? 'nieuw'
  : (descL.includes('snel weg') || descL.includes('emigrat')) ? 'urgent' : 'gebruikt';

const bod       = Math.round(prijs * 0.82);
const verkoop   = heeftSchade ? Math.round(marktwaarde * 0.65) : Math.round(marktwaarde * 0.90);
const winst     = Math.max(0, verkoop - bod);
const winstPerc = bod > 0 ? Math.round(winst / bod * 100) : 0;

if (winst < 20) return null;

const hot = winstPerc >= 30 || prijs < marktwaarde * 0.60 || soort === 'urgent';

const gbMatch = titel.match(/(\d+)\s*(?:GB|gb)/);
const opslag  = gbMatch ? gbMatch[1] + ' GB' : '?';
const isIphone = titelL.includes('iphone');

return {
  titel, desc, locatie, verkoper, foto, url, datum,
  prijs, bod, verkoop, winst, winstPerc, marktwaarde,
  soort, hot, opslag, isIphone, heeftSchade,
};
```

} catch (e) {
return null;
}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PhoneFlip API draait op poort ${PORT}`));
