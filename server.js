const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const MARKTWAARDEN = {
  'iphone 15 pro': 720, 'iphone 15': 600, 'iphone 14 pro': 620,
  'iphone 14': 480, 'iphone 13 pro': 450, 'iphone 13': 280,
  'iphone 12 pro': 240, 'iphone 12': 190, 'iphone 11 pro': 200,
  'iphone 11': 170, 'iphone xr': 140, 'iphone se': 130,
  'samsung galaxy s23': 500, 'samsung galaxy s22': 380,
  'samsung galaxy s21': 280, 'samsung galaxy s20': 220,
  'samsung galaxy a53': 230, 'samsung galaxy a52': 180,
};

function getMarktwaarde(titel) {
  const t = titel.toLowerCase();
  for (const [model, prijs] of Object.entries(MARKTWAARDEN)) {
    if (t.includes(model)) return prijs;
  }
  if (t.includes('iphone')) return 200;
  if (t.includes('samsung')) return 180;
  return 150;
}

const ZOEKTERMEN = [
  'iphone 13','iphone 12','iphone 11','samsung galaxy s22',
  'iphone 14','samsung galaxy s21','iphone xr','samsung galaxy a53',
  'iphone se','samsung galaxy s23','iphone 12 pro','samsung galaxy a52',
];

let zoekIndex = 0;

app.get('/', (req, res) => {
  res.json({ status: 'PhoneFlip API actief' });
});

app.get('/api/deals', async (req, res) => {
  const items = [];
  for (let i = 0; i < 5; i++) {
    const term = ZOEKTERMEN[(zoekIndex + i) % ZOEKTERMEN.length];
    try {
      const url = `https://www.marktplaats.nl/lrp/api/search?query=${encodeURIComponent(term)}&l1CategoryId=20&l2CategoryId=328&priceFrom=50&priceTo=600&limit=15&offset=0&sortBy=SORT_INDEX&sortOrder=DECREASING`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'application/json',
        }
      });
      if (r.ok) {
        const data = await r.json();
        items.push(...(data.listings || []));
      }
    } catch(e) { console.error(term, e.message); }
  }
  zoekIndex = (zoekIndex + 5) % ZOEKTERMEN.length;

  const deals = items.map(item => {
    try {
      const prijs = item.priceInfo?.priceCents ? Math.round(item.priceInfo.priceCents / 100) : 0;
      if (!prijs || prijs < 50 || prijs > 600) return null;
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
      const hot = winstPerc >= 30 || prijs < marktwaarde * 0.60;
      const gbMatch = titel.match(/(\d+)\s*(?:GB|gb)/);
      return {
        titel, desc,
        locatie: item.location?.cityName || 'Nederland',
        verkoper: item.sellerInformation?.displayName || 'Particulier',
        foto: item.pictures?.[0]?.mediumUrl || null,
        url: item.vipUrl ? `https://www.marktplaats.nl${item.vipUrl}` : 'https://www.marktplaats.nl/l/telecommunicatie/mobiele-telefoons/',
        datum: 'Recent',
        prijs, bod, verkoop, winst, winstPerc, marktwaarde,
        soort: heeftSchade ? 'schade' : 'gebruikt',
        hot, heeftSchade, isIphone: titelL.includes('iphone'),
        opslag: gbMatch ? gbMatch[1] + ' GB' : '?',
      };
    } catch(e) { return null; }
  }).filter(Boolean).sort((a,b) => b.winstPerc - a.winstPerc);

  res.json({ deals, totaal: deals.length });
});

app.listen(process.env.PORT || 3000, () => console.log('PhoneFlip API actief'));
