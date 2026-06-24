// Generates the Wellington / Tauranga / Hamilton city pages from the Auckland
// shell + per-city content kit (Downloads/city-pages-content.md, transcribed
// faithfully here). Header, footer, styles, scripts are identical to Auckland;
// only head meta, JSON-LD, and <main> change. No em dashes in copy (kit rule).
import fs from 'node:fs';
import path from 'node:path';

const DEST = 'C:/code/cleaning-jobs';
const shell = fs.readFileSync(path.join(DEST, 'src/pages/cleaning-jobs-auckland/index.astro'), 'utf8');

// Split the Auckland shell into [head+header before <main>] + [after </main>].
const beforeMain = shell.slice(0, shell.indexOf('  <main id="main">'));
const afterMain = shell.slice(shell.indexOf('</main>') + '</main>'.length);

const ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4 10-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const tick = (t) => `              <div class="tick-row"><span class="check" aria-hidden="true">${TICK}</span><span class="lbl">${t}</span></div>`;
const faq = (q, a) => `          <details class="faq-item"><summary>${q}<span class="ico" aria-hidden="true">${PLUS}</span></summary><div class="answer"><p>${a}</p></div></details>`;

const CITIES = [
  {
    slug: 'cleaning-jobs-wellington', css: 'city-wellington', name: 'Wellington',
    title: 'Cleaning Jobs in Wellington | Apply Once | Cleaning Jobs NZ',
    desc: 'Apply once for cleaning jobs in Wellington. Suitable applicants complete Spruce onboarding and become eligible for office, commercial, and residential cleaning work across the capital and greater region.',
    ogTitle: 'Cleaning Jobs in Wellington | Cleaning Jobs NZ',
    ogDesc: 'Apply once for Spruce-standard cleaning work across Wellington and the greater region.',
    h1: 'Cleaning jobs in Wellington.',
    lead: 'Apply once to be considered for Spruce-standard cleaning work across Wellington and the greater region. We review every application individually and contact suitable applicants about a next step.',
    acrossCallout: 'Wellington leans heavily toward commercial and office work.',
    acrossIntro: 'As the capital, Wellington has a compact, hilly centre packed with government and corporate offices, which drives steady demand for scheduled commercial cleans. Residential work is spread across the surrounding suburbs and the greater region, so where you can be considered depends on the areas you can reach and the hours you can cover.',
    areas: [
      'Wellington central, Te Aro and Thorndon',
      'Western suburbs (Kelburn, Karori)',
      'Eastern and southern suburbs (Miramar, Kilbirnie, Newtown)',
      'Northern suburbs (Johnsonville, Tawa)',
      'Greater Wellington (Lower Hutt, Upper Hutt, Porirua)',
    ],
    typesH2: 'The cleaning work you could be allocated in Wellington',
    typesIntro: "The capital's mix tilts toward offices and commercial sites, with residential work across the hills and valleys. Suitable Spruce-certified cleaners are considered for three broad areas.",
    homesBlurb: "Regular and one-off cleans across Wellington's suburbs and the Hutt Valley, plus end-of-tenancy work in a tight rental market.",
    bizBlurb: 'Strong demand from government and corporate offices in the CBD, plus retail and commercial sites across the region.',
    specBlurb: "Builders' and handover cleans, carpet and upholstery support, and window cleaning support.",
    typesNote: 'Not every work type is available in every part of the region. Allocation depends on demand, suitability, availability, and certification.',
    whyH2: 'One application for cleaning work across the capital.',
    whyIntro: "Wellington's centre is small but its work is spread from the waterfront offices to the Hutt and Porirua. Apply once and we keep your details on file, then consider suitable applicants as demand comes up.",
    why: [
      ['One place to apply', 'Apply once for Wellington cleaning work instead of role by role.'],
      ['Built for commercial', "Onboarding and training to the Spruce standard, which suits the capital's heavy office and commercial demand."],
      ['Matched to your area', 'Considered for work based on your location, transport, availability, and certification.'],
    ],
    ctaH2: 'Apply for cleaning work in Wellington.',
    ctaBody: "Tell us your area, experience, availability, and the type of cleaning work you suit. We'll review your application and contact you if there's a suitable next step.",
    faqEyebrow: 'Wellington questions', faqH2: 'Applying in Wellington',
    faqs: [
      ['Do you cover the Hutt Valley and Porirua?', "Yes. Demand spans greater Wellington, so cleaners based in Lower Hutt, Upper Hutt, and Porirua are often well placed for work near them. Apply with your location and we'll know which areas you can cover."],
      ['Is there more office work than home work here?', 'Often, yes. As the capital, Wellington has heavy office and commercial demand, alongside residential work across the suburbs. We ask which work types you suit in the application.'],
      ['Do the hills and transport matter?', 'They can. Wellington is compact but hilly, and public transport is good in the centre. We ask about your location and transport so we can match you to realistic work.'],
    ],
  },
  {
    slug: 'cleaning-jobs-tauranga', css: 'city-tauranga', name: 'Tauranga',
    title: 'Cleaning Jobs in Tauranga | Apply Once | Cleaning Jobs NZ',
    desc: "Apply once for cleaning jobs in Tauranga and the Bay of Plenty. Suitable applicants complete Spruce onboarding and become eligible for residential, commercial, and specialist cleaning work in one of New Zealand's fastest-growing cities.",
    ogTitle: 'Cleaning Jobs in Tauranga | Cleaning Jobs NZ',
    ogDesc: 'Apply once for Spruce-standard cleaning work across Tauranga and the wider Bay of Plenty.',
    h1: 'Cleaning jobs in Tauranga.',
    lead: 'Apply once to be considered for Spruce-standard cleaning work across Tauranga and the wider Bay of Plenty. We review every application individually and contact suitable applicants about a next step.',
    acrossCallout: "Tauranga is one of the country's fastest-growing cities.",
    acrossIntro: "Rapid growth across Tauranga and the Western Bay of Plenty means new homes, new businesses, and steady turnover in rentals and holiday accommodation. That fuels demand for residential, end-of-tenancy, and builders' cleans in particular, especially around the newer coastal subdivisions.",
    areas: [
      'Tauranga central and Otumoetai',
      'Mount Maunganui',
      'Papamoa',
      'Bethlehem and Pyes Pa',
      'Welcome Bay, Greerton, and the Western Bay',
    ],
    typesH2: 'The cleaning work you could be allocated in Tauranga',
    typesIntro: 'A growing, coastal city means plenty of residential and new-build work, with commercial demand rising alongside it. Suitable Spruce-certified cleaners are considered for three broad areas.',
    homesBlurb: 'Regular and one-off cleans across a fast-growing residential market, with strong end-of-tenancy demand from rentals and holiday homes near the coast.',
    bizBlurb: 'Scheduled cleans for a growing commercial base, from the city centre to business and retail sites across the bay.',
    specBlurb: "Builders' and handover cleans tied to Tauranga's construction boom, plus carpet, upholstery, and window cleaning support.",
    typesNote: 'Not every work type is available in every part of the bay. Allocation depends on demand, suitability, availability, and certification.',
    whyH2: 'One application for cleaning work across a growing city.',
    whyIntro: 'With new subdivisions opening up across the bay, work appears in different areas at different times. Apply once, and we keep your details on file so suitable applicants can be considered as demand shifts.',
    why: [
      ['One place to apply', 'Apply once for Bay of Plenty cleaning work instead of role by role.'],
      ['Built for growth', 'Onboarding and training to the Spruce standard, ready for a market adding homes and businesses quickly.'],
      ['Matched to your area', 'Considered for work based on your location, transport, availability, and certification.'],
    ],
    ctaH2: 'Apply for cleaning work in Tauranga.',
    ctaBody: "Tell us your area, experience, availability, and the type of cleaning work you suit. We'll review your application and contact you if there's a suitable next step.",
    faqEyebrow: 'Tauranga questions', faqH2: 'Applying in Tauranga',
    faqs: [
      ['Do you cover the Mount and Papamoa?', "Yes. Coastal growth around Mount Maunganui and Papamoa drives a lot of residential and end-of-tenancy work. Apply with your location and we'll know which areas you can cover."],
      ["Is there much new-build and builders' clean work?", "Often, yes. Tauranga's construction activity means handover and builders' cleans come up alongside regular residential work. We ask which work types you suit in the application."],
      ['Is the work seasonal near the coast?', "It can vary. Holiday accommodation turnover adds demand at certain times of year. Apply with your availability and we'll consider you for suitable work as it comes up."],
    ],
  },
  {
    slug: 'cleaning-jobs-hamilton', css: 'city-hamilton', name: 'Hamilton',
    title: 'Cleaning Jobs in Hamilton | Apply Once | Cleaning Jobs NZ',
    desc: 'Apply once for cleaning jobs in Hamilton and the Waikato. Suitable applicants complete Spruce onboarding and become eligible for residential, commercial, and specialist cleaning work in a growing river city.',
    ogTitle: 'Cleaning Jobs in Hamilton | Cleaning Jobs NZ',
    ogDesc: 'Apply once for Spruce-standard cleaning work across Hamilton and the Waikato.',
    h1: 'Cleaning jobs in Hamilton.',
    lead: 'Apply once to be considered for Spruce-standard cleaning work across Hamilton and the Waikato. We review every application individually and contact suitable applicants about a next step.',
    acrossCallout: 'Hamilton blends student rentals with fast-growing suburbs.',
    acrossIntro: "As the Waikato's main centre and a university city, Hamilton has steady rental turnover that drives end-of-tenancy work, alongside a wave of new housing in the growing northern suburbs. Commercial demand sits along the main routes and the city centre, so the work mix depends on which part of the city you can reach.",
    areas: [
      'Hamilton Central and Hamilton East',
      'Rototuna and Flagstaff',
      'Chartwell and Hillcrest',
      'Te Rapa and Frankton',
      'Dinsdale and the western suburbs',
    ],
    typesH2: 'The cleaning work you could be allocated in Hamilton',
    typesIntro: 'A university city with growing suburbs means strong residential and end-of-tenancy work, plus commercial demand along the main routes. Suitable Spruce-certified cleaners are considered for three broad areas.',
    homesBlurb: 'Regular and one-off home cleans across the suburbs, with notable end-of-tenancy demand from student and rental turnover.',
    bizBlurb: 'Scheduled cleans for the city centre and commercial sites along Te Rapa and the main arterials.',
    specBlurb: "Builders' and handover cleans tied to new housing in the north, plus carpet, upholstery, and window cleaning support.",
    typesNote: 'Not every work type is available in every part of the city. Allocation depends on demand, suitability, availability, and certification.',
    whyH2: 'One application for cleaning work across the Waikato hub.',
    whyIntro: 'Between rental turnover and new northern suburbs, Hamilton work moves around the city through the year. Apply once and we keep your details on file, then consider suitable applicants as demand comes up.',
    why: [
      ['One place to apply', 'Apply once for Waikato cleaning work instead of role by role.'],
      ['Spruce standard behind it', 'Onboarding and training to the same checklists and expectations used on every Spruce clean.'],
      ['Matched to your area', 'Considered for work based on your location, transport, availability, and certification.'],
    ],
    ctaH2: 'Apply for cleaning work in Hamilton.',
    ctaBody: "Tell us your area, experience, availability, and the type of cleaning work you suit. We'll review your application and contact you if there's a suitable next step.",
    faqEyebrow: 'Hamilton questions', faqH2: 'Applying in Hamilton',
    faqs: [
      ['Is there a lot of end-of-tenancy work here?', 'Often, yes. As a university city, Hamilton has steady rental turnover, which drives end-of-tenancy cleans alongside regular residential work. We ask which work types you suit in the application.'],
      ['Do you cover the newer northern suburbs?', "Yes. Growth in Rototuna and Flagstaff adds residential and new-build work in the north. Apply with your location and we'll know which areas you can cover."],
      ['Do I need transport in Hamilton?', 'It helps. Work can be spread from the centre to the growing suburbs, so reliable transport widens what you can be considered for. We ask about this in the application.'],
    ],
  },
];

const C = 'https://cleaningjobs.co.nz';

function buildHead(city) {
  // Start from Auckland's head+header, swap the Auckland-specific strings.
  let h = beforeMain;
  h = h.replace('// cleaning-jobs-auckland — ported from cleaning-jobs-auckland.html (pixel-for-pixel).',
    `// ${city.slug} — generated from cleaning-jobs-auckland shell + city content kit.`);
  h = h.replace("import '../../styles/city-auckland.css';", `import '../../styles/${city.css}.css';`);
  h = h.replace('<title>Cleaning Jobs in Auckland | Apply Once | Cleaning Jobs NZ</title>', `<title>${city.title}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${city.desc}" />`);
  h = h.replace(`<link rel="canonical" href="${C}/cleaning-jobs-auckland/" />`, `<link rel="canonical" href="${C}/${city.slug}/" />`);
  h = h.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${city.ogTitle}" />`);
  h = h.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${city.ogDesc}" />`);
  h = h.replace(`<meta property="og:url" content="${C}/cleaning-jobs-auckland/" />`, `<meta property="og:url" content="${C}/${city.slug}/" />`);
  h = h.replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${city.ogTitle}" />`);
  h = h.replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${city.ogDesc}" />`);
  // JSON-LD WebPage
  h = h.replace('"name": "Cleaning Jobs in Auckland | Cleaning Jobs NZ",', `"name": "${city.ogTitle}",`);
  h = h.replace(/"description": "Apply once for Spruce-standard cleaning work across Auckland\. Suitable applicants are considered for residential, commercial, and specialist work allocation\.",/,
    `"description": "${city.ogDesc} Suitable applicants are considered for residential, commercial, and specialist work allocation.",`);
  h = h.replace('"url": "https://cleaningjobs.co.nz/cleaning-jobs-auckland/"\n  }', `"url": "${C}/${city.slug}/"\n  }`);
  // JSON-LD breadcrumb
  h = h.replace('"name": "Cleaning jobs in Auckland",', `"name": "Cleaning jobs in ${city.name}",`);
  h = h.replace('"item": "https://cleaningjobs.co.nz/cleaning-jobs-auckland/"', `"item": "${C}/${city.slug}/"`);
  return h;
}

function buildMain(city) {
  return `  <main id="main">
    <section class="hero">
      <div class="wrap">
        <span class="eyebrow">${city.name}</span>
        <h1>${city.h1}</h1>
        <p class="lead">${city.lead}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="/apply/">Apply now ${ICON}</a>
          <a class="btn btn-outline" href="/how-it-works/">How it works</a>
        </div>
      </div>
    </section>

    <section class="block tint">
      <div class="wrap">
        <div class="reliable-split">
          <div class="reliable-left">
            <span class="eyebrow">Across the region</span>
            <h2>Cleaning work across ${city.name}.</h2>
            <p class="callout">${city.acrossCallout}</p>
            <p>${city.acrossIntro}</p>
          </div>
          <div class="tick-panel">
            <div class="tick-list">
${city.areas.map(tick).join('\n')}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="wrap">
        <div class="sec-head">
          <span class="eyebrow">Work types</span>
          <h2>${city.typesH2}</h2>
          <p>${city.typesIntro}</p>
        </div>
        <div class="types-groups">
          <div class="tgroup">
            <span class="label">Homes</span>
            <h3>Residential cleaning</h3>
            <p class="blurb">${city.homesBlurb}</p>
            <ul><li>Residential cleaning</li><li>Deep cleaning</li><li>End of tenancy</li></ul>
          </div>
          <div class="tgroup">
            <span class="label">Business</span>
            <h3>Office &amp; commercial</h3>
            <p class="blurb">${city.bizBlurb}</p>
            <ul><li>Office cleaning</li><li>Commercial cleaning</li></ul>
          </div>
          <div class="tgroup">
            <span class="label">Specialist</span>
            <h3>Trades-adjacent &amp; add-on</h3>
            <p class="blurb">${city.specBlurb}</p>
            <ul><li>Builders &amp; handover cleans</li><li>Carpet &amp; upholstery support</li><li>Window cleaning support</li></ul>
          </div>
        </div>
        <div class="types-note">
          ${city.typesNote}
        </div>
      </div>
    </section>

    <section class="block tint">
      <div class="wrap">
        <div class="why-split">
          <div class="why-left">
            <span class="eyebrow">Why apply here</span>
            <h2>${city.whyH2}</h2>
            <p>${city.whyIntro}</p>
          </div>
          <div class="why-panel">
            <div class="why-rows">
              <div class="why-row"><span class="n">01</span><div><h3>${city.why[0][0]}</h3><p>${city.why[0][1]}</p></div></div>
              <div class="why-row"><span class="n">02</span><div><h3>${city.why[1][0]}</h3><p>${city.why[1][1]}</p></div></div>
              <div class="why-row"><span class="n">03</span><div><h3>${city.why[2][0]}</h3><p>${city.why[2][1]}</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-band" id="apply-cta">
      <div class="wrap">
        <h2>${city.ctaH2}</h2>
        <p>${city.ctaBody}</p>
        <div class="actions">
          <a class="btn btn-primary" href="/apply/">Start application ${ICON}</a>
          <a class="btn btn-on-dark" href="/faq/">Read the FAQ</a>
        </div>
        <p class="small-note">Work is not guaranteed. Allocation depends on demand, suitability, availability, and certification.</p>
      </div>
    </section>

    <section class="block faq-block">
      <div class="wrap">
        <div class="sec-head">
          <span class="eyebrow">${city.faqEyebrow}</span>
          <h2>${city.faqH2}</h2>
        </div>
        <div class="faq-list">
${city.faqs.map(([q, a]) => faq(q, a)).join('\n')}
        </div>
      </div>
    </section>
  </main>`;
}

const auckCss = fs.readFileSync(path.join(DEST, 'src/styles/city-auckland.css'), 'utf8');
for (const city of CITIES) {
  // Each city reuses the identical Auckland stylesheet.
  fs.writeFileSync(path.join(DEST, `src/styles/${city.css}.css`), auckCss, 'utf8');
  fs.mkdirSync(path.join(DEST, `src/pages/${city.slug}`), { recursive: true });
  const out = buildHead(city) + buildMain(city) + afterMain;
  fs.writeFileSync(path.join(DEST, `src/pages/${city.slug}/index.astro`), out, 'utf8');
  const confirm = (out.match(/Auckland|auckland/g) || []).length;
  console.log(`wrote ${city.slug}/index.astro  (${out.length}b, residual 'Auckland' mentions: ${confirm})`);
}
