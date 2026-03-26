const express = require(‘express’);
const app = express();

app.use((req, res, next) => {
res.header(‘Access-Control-Allow-Origin’, ‘*’);
next();
});

// Echte marktwaarden NL 2026
const MARKTWAARDEN = {
‘iphone 15 pro’: 720, ‘iphone 15’: 600, ‘iphone 14 pro’: 620,
‘iphone 14’: 480, ‘iphone 13 pro’: 450, ‘iphone 13’: 280,
‘iphone 12 pro’: 240, ‘iphone 12’: 190, ‘iphone 11 pro’: 200,
‘iphone 11’: 170, ‘iphone xr’: 140, ‘iphone se’: 130,
‘samsung galaxy s23’: 500, ‘samsung galaxy s22’: 380,
‘samsung galaxy s21’: 280, ‘samsung galaxy s20’: 220,
‘samsung galaxy a53’: 230, ‘samsung galaxy a52’: 180,
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

const ZOEKTERMEN = [
‘iphone 13’, ‘iphone 12’, ‘iphone 11’, ‘samsung galaxy s22’,
‘iphone 14’, ‘samsung galaxy s21’, ‘iphone xr’, ‘samsung galaxy a53’,
‘iphone se’, ‘samsung galaxy s23’, ‘iphone 12 pro’, ‘samsung galaxy a52’,
];

let zoekIndex = 0;

app.get(’/’, (req, res) => {
res.json({ status: ‘PhoneFlip API actief’, endpoint: ‘/api/deals’ });
});

app.get(’/api/deals’, async (req, res) => {
const items = [];

for (let i = 0; i < 5; i++) {
const term = ZOEKTERMEN[(zoekIndex + i) % ZOEKTERMEN.length];
try {
// Zelfde endpoint als AutoFlip - algemene search zonder subcategorie filter
// zodat Marktplaats hem niet blokkeert
const url = `https://www.marktplaats.nl/lrp/api/search?query=${encodeURIComponent(term)}&l1CategoryId=20&l2CategoryId=328&priceFrom=50&priceTo=600&limit=20&offset=0&sortBy=SORT_INDEX&sortOrder=DECREASING`;

```
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.marktplaats.nl/',
      'Origin': 'https://www.marktplaats.nl',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    }
  });

  if (r.ok) {
    const data = await r.json();
    const listings = data.listings || [];
    console.log(`✓ ${term}: ${listings.length} resultaten`);
    items.push(...listings);
  } else {
    console.log(`✗ ${term}: HTTP ${r.status}`);
  }
} catch(e) {
  console.error(`✗ ${term}:`, e.message);
}
```

}

zoekIndex = (zoekIndex + 5) % ZOEKTERMEN.length;

console.log(`Totaal opgehaald: ${items.length} items`);

const deals = items.map(item => {
try {
const prijs = item.priceInfo?.priceCents
? Math.round(item.priceInfo.priceCents / 100) : 0;
if (!prijs || prijs < 50 || prijs > 600) return null;

```
  const titel = (item.title || '').trim();
  const titelL = titel.toLowerCase();
  const desc = (item.description || '').slice(0, 300);
  const descL = desc.toLowerCase();

  if (!titelL.includes('iphone') && !titelL.includes('samsung')) return null;
  if (descL.includes('icloud') && descL.includes('lock')) return null;

  const marktwaarde = getMarktwaarde(titel);
  if (prijs >= marktwaarde * 0.92) return null;

  const bod = Math.round(prijs * 0.82);
  const verkoop = Math.round(marktwaarde * 0.90);
  const winst = Math.max(0, verkoop - bod);
  const winstPerc = bod > 0 ? Math.round(winst / bod * 100) : 0;
  if (winst < 20) return null;

  const heeftSchade = ['schade','barst','kapot','defect','kras','crack'].some(w => descL.includes(w));
  const hot = winstPerc >= 30 || prijs < marktwaarde * 0.65;
  const gbMatch = titel.match(/(\d+)\s*(?:GB|gb)/);

  let datum = 'Recent';
  try {
    if (item.date) {
      const d = new Date(item.date);
      if (!isNaN(d.getTime())) {
        datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
      }
    }
  } catch(e) {}

  return {
    titel, desc,
    locatie: item.location?.cityName || 'Nederland',
    verkoper: item.sellerInformation?.displayName || 'Particulier',
    foto: item.pictures?.[0]?.mediumUrl || null,
    url: item.vipUrl ? `https://www.marktplaats.nl${item.vipUrl}` : 'https://www.marktplaats.nl/l/telecommunicatie/mobiele-telefoons/',
    datum, prijs, bod, verkoop, winst, winstPerc, marktwaarde,
    soort: heeftSchade ? 'schade' : 'gebruikt',
    hot, heeftSchade,
    isIphone: titelL.includes('iphone'),
    opslag: gbMatch ? gbMatch[1] + ' GB' : '?',
  };
} catch(e) { return null; }
```

})
.filter(Boolean)
.sort((a, b) => {
if (b.hot !== a.hot) return b.hot ? 1 : -1;
return b.winstPerc - a.winstPerc;
});

console.log(`Deals na filter: ${deals.length}`);
res.json({ deals, totaal: deals.length, timestamp: new Date().toISOString() });
});

app.listen(process.env.PORT || 3000, () => {
console.log(‘PhoneFlip API actief op poort’, process.env.PORT || 3000);
});
