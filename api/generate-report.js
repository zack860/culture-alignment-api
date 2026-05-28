const PDFDocument = require('pdfkit');
const { put } = require('@vercel/blob');

const SLIDERS = [
  { label: 'Decision-Making Style',      left: 'Formal approval',          right: 'Empowered' },
  { label: 'Operational Mindset',         left: 'Growth mentality',         right: 'Lean mentality' },
  { label: 'Strategic Responsiveness',    left: 'Anticipate/prevent',       right: 'React/fix' },
  { label: 'Strategic Horizon',           left: 'Incremental improvements', right: 'Big picture/bold ideas' },
  { label: 'Organizational Alignment',    left: 'Company-oriented',         right: 'Group-oriented' },
  { label: 'Risk Profile',                left: 'Risk averse',              right: 'Comfortable with risk' },
];

const SLIDER_QUESTIONS = [
  'In your organization, do people tend to seek formal approvals or do they feel empowered to make decisions?',
  "What is your organization's attitude towards trade-offs between growth and cost?",
  'Is your organization focused more on anticipating future opportunities and problems or on addressing issues and client needs as they arise?',
  'Is your organization focused more on incremental improvements, or on big picture/bold ideas?',
  'Do people demonstrate greater loyalty to the company as a whole or to specific groups e.g., functions, departments?',
  "What is your organization's attitude towards risk?",
];

const SLIDER_TEXT = [
  ['strong lean towards Formal approval','lean towards Formal approval','slight lean towards Formal approval','your organization sits in the middle on this metric','slight lean towards Empowered decision-making','lean towards Empowered decision-making','strong lean towards Empowered decision-making'],
  ['strong lean towards a Growth mentality','lean towards a Growth mentality','slight lean towards a Growth mentality','your organization sits in the middle on this metric','slight lean towards a Lean mentality','lean towards a Lean mentality','strong lean towards a Lean mentality'],
  ['strong lean towards Anticipate/prevent','lean towards Anticipate/prevent','slight lean towards Anticipate/prevent','your organization sits in the middle on this metric','slight lean towards React/fix','lean towards React/fix','strong lean towards React/fix'],
  ['strong lean towards Incremental improvements','lean towards Incremental improvements','slight lean towards Incremental improvements','your organization sits in the middle on this metric','slight lean towards Big Picture/bold ideas','lean towards Big Picture/bold ideas','strong lean towards Big Picture/bold ideas'],
  ['strong lean towards being Company-oriented','lean towards being Company-oriented','slight lean towards being Company-oriented','your organization sits in the middle on this metric','slight lean towards being Group-oriented','lean towards being Group-oriented','strong lean towards being Group-oriented'],
  ['strong lean towards being Risk averse','lean towards being Risk averse','slight lean towards being Risk averse','your organization sits in the middle on this metric','slight lean towards being Comfortable with risk','lean towards being Comfortable with risk','strong lean towards being Comfortable with risk'],
];

const CHOICE_LABELS = [
  'Senior Leader Customer Engagement',
  'Leadership Decision Driver',
  'Frontline Employee Empowerment',
  'Customer Data Usage',
];

const CHOICE_QUESTIONS = [
  'How frequently do your senior leaders engage directly with real customers?',
  'What drives leadership decisions most often?',
  'How empowered are frontline employees to solve customer problems?',
  'How is customer data used across the organization?',
];

function getSliderSentence(idx, val) {
  const t = SLIDER_TEXT[idx][val];
  return val === 3 ? `Your score indicates ${t}.` : `Your score indicates a ${t}.`;
}

function detectClashes(sv, cv) {
  const [s1, s2, s3, s4, s5, s6] = sv;
  const [c1, c2, c3, c4] = cv;
  const lo = v => v <= 2;
  const hi = v => v >= 4;
  const clashes = [];

  if (c3 === 'Fully trusted to act on behalf of the customer' && lo(s1))
    clashes.push({ title: 'Performative Empowerment', text: 'The Clash: Frontline is highly empowered (Faster), BUT the overall culture requires formal approvals for decisions (Slow). You give lip service to customer obsession, but your internal engine is bogged down by bureaucracy. You are putting a band-aid on a broken internal process, meaning your frontline is likely burning out trying to hack your own system to help the customer.' });

  if (hi(s4) && c1 === 'Rarely or never')
    clashes.push({ title: 'Ivory Tower Innovation', text: 'The Clash: Focus is heavily on big, bold ideas (Better), BUT leaders rarely engage directly with real customers (Avoidant). Your leadership team is swinging for the fences, but they are doing it blindfolded. Bold ideas built on internal assumptions rather than lived customer friction lead to expensive products that no one actually wants. You have a high risk of product-market-fit failure.' });

  if (hi(s6) && lo(s1))
    clashes.push({ title: 'The "Brakes & Gas" Frustration', text: 'The Clash: You have a high tolerance for risk (Faster), BUT work requires strict, formal chains of command/approvals. Your culture wants to move fast and break things, but your structural bureaucracy refuses to let them. This mismatch creates massive internal friction, driving away top talent who feel like they are driving a sports car in a traffic jam.' });

  if (c3 === 'Fully trusted to act on behalf of the customer' && hi(s5))
    clashes.push({ title: 'Fragmented Empathy', text: 'The Clash: Frontline is empowered to solve issues, BUT employees show intense loyalty to their specific departments/silos (Cheaper). Individual employees give great service, but the overall customer journey is a disaster. Because departments operate as isolated tribes, hand-offs between teams are clunky and hostile. You are making the customer feel the weight of your org chart.' });

  if (c4 === 'Integrated into daily dashboards and product decisions' && c1 === 'Rarely or never')
    clashes.push({ title: 'Management by Spreadsheet', text: 'The Clash: Customer data is highly integrated into dashboards and decisions (Better), BUT leaders never actually speak to them (Avoidant). You are customer-tolerant, not customer-driven. By viewing customers merely as data points and metrics rather than humans, your leadership team is totally insulated from shifting market sentiments. You will miss the qualitative "why" behind the quantitative "what."' });

  if (hi(s4) && lo(s6))
    clashes.push({ title: 'Aspirational Paralysis', text: 'The Clash: The focus is on disruptive, big picture ideas (Better), BUT the organization is highly risk-averse (Cheaper). Your organization wants to innovate, but structurally punishes the failure required to get there. Because your risk tolerance is zero, your boldest ideas will be watered down by committee until they are completely unrecognizable by the time they hit the market.' });

  if (lo(s2) && c2 === 'Internal politics, founder legacy, or gut feel')
    clashes.push({ title: 'Stifled Scaling', text: 'The Clash: Pure growth mentality at all costs (Better), BUT leadership decisions are driven by internal politics or founder legacy (Cheaper). You have the ambition to scale, but your growth is actively bottlenecked by ego and outdated operating models at the very top. You cannot scale a future-facing business using a backward-looking leadership framework.' });

  if (c3 === 'Fully trusted to act on behalf of the customer' && hi(s3))
    clashes.push({ title: 'The "Firefighter" Exhaustion', text: 'The Clash: Frontline is highly empowered (Faster), BUT the overall organization is entirely reactive to issues (Cheaper). You have incredible "firefighters," but you are constantly burning down your own house. Because your leadership refuses to proactively fix root causes upstream, your empowered frontline is exhausted from playing endless whack-a-mole with easily preventable customer issues.' });

  if (c4 === 'Integrated into daily dashboards and product decisions' && lo(s1))
    clashes.push({ title: 'Data-Rich, Action-Poor', text: 'The Clash: Customer data is highly integrated into workflows (Better), BUT employees require formal approvals to make decisions (Slow). You have all the answers, but you move too slowly to capitalize on them. By the time a data-backed recommendation makes it through your extensive chain of command, the market has already moved on. Your insights are expiring before they can be executed.' });

  if (c4 === 'Integrated into daily dashboards and product decisions' && c2 === 'Internal politics, founder legacy, or gut feel')
    clashes.push({ title: 'The HiPPO Syndrome', text: 'The Clash: Customer data is widely distributed and analyzed (Better), BUT leadership decisions are still driven by internal politics or gut-feel (Cheaper). Your data is just window dressing. You invest heavily in Voice of the Customer tools and dashboards, but at the end of the day, the "HiPPO" (Highest Paid Person\'s Opinion) still dictates your strategy.' });

  if (lo(s2) && hi(s3))
    clashes.push({ title: 'Unfunded Mandates', text: 'The Clash: The focus is heavily on aggressive growth (Better), BUT the organization only addresses operational issues reactively (Cheaper). You are stepping on the gas without looking at the road ahead. You have aggressive growth mandates, but because you refuse to invest in proactive infrastructure, your scaling efforts will constantly be derailed by unforeseen operational bottlenecks.' });

  return clashes;
}

// Parse Jotform rawRequest string into clean data object
function parseRawRequest(rawStr) {
  const raw = JSON.parse(rawStr);
  const nameObj = raw.q3_q3_fullname1 || {};
  const first = nameObj.first || '';
  const last = nameObj.last || '';
  return {
    name: `${first} ${last}`.trim() || 'Respondent',
    email: raw.q4_q4_email2 || '',
    company: raw.q5_q5_textbox3 || 'Your Organization',
    s1: raw.q7_q7_scale5,
    s2: raw.q8_q8_scale6,
    s3: raw.q9_q9_scale7,
    s4: raw.q10_q10_scale8,
    s5: raw.q11_q11_scale9,
    s6: raw.q12_q12_scale10,
    c1: raw.q14_q14_radio12,
    c2: raw.q15_q15_radio13,
    c3: raw.q16_q16_radio14,
    c4: raw.q17_q17_radio15,
  };
}

function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const { name = 'Respondent', company = 'Your Organization', s1, s2, s3, s4, s5, s6, c1, c2, c3, c4 } = data;
    const sv = [s1, s2, s3, s4, s5, s6].map(Number);
    const cv = [c1, c2, c3, c4];

    const doc = new PDFDocument({ size: 'LETTER', margin: 56, bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const CW = 500;
    const ML = 56;
    const ACCENT = '#3C3489';
    const DARK   = '#1a1a2e';
    const MID    = '#5F5E5A';
    const LIGHT  = '#888780';
    const BG     = '#F8F7F4';
    const GREEN  = '#1D9E75';
    const GLIGHT = '#0F6E56';
    const GDARK  = '#173404';
    const ORANGE = '#D85A30';
    const OPALE  = '#FAECE7';
    const ODARK  = '#4A1B0C';
    const OMID   = '#993C1D';
    const GBG    = '#EAF3DE';
    const GBORD  = '#3B6D11';

    let y = 0;

    function needPage(h) {
      if (y + h > 730) { doc.addPage(); y = 56; }
    }

    doc.rect(0, 0, 612, 115).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Culture Alignment Demo Assessment', ML, 28, { width: CW });
    doc.font('Helvetica').fontSize(11).text('Preliminary Insights Report', ML, 60);
    doc.fontSize(10).text(`${name}  ·  ${company}`, ML, 76);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.6)').text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), ML, 95);

    y = 130;

    const introText = 'Thank you for completing the Culture Alignment Demo. This report is designed to act as a "movie preview" of your operational culture. Based on your inputs, we have mapped your self-reported behaviors against our diagnostic framework to highlight potential areas of friction between your stated strategy and your daily reality.';
    const introH = doc.font('Helvetica').fontSize(10).heightOfString(introText, { width: CW - 28, lineGap: 2 }) + 38;
    doc.rect(ML, y, CW, introH).fill(BG);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text('Welcome to Your Preliminary Insights', ML + 14, y + 12);
    doc.fillColor(MID).font('Helvetica').fontSize(10).text(introText, ML + 14, y + 30, { width: CW - 28, lineGap: 2 });
    y += introH + 18;

    needPage(30);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15).text('Your Response Recap', ML, y);
    doc.rect(ML, y + 19, 36, 2).fill(ACCENT);
    y += 32;

    sv.forEach((val, i) => {
      const sentence = getSliderSentence(i, val);
      const qH = doc.font('Helvetica').fontSize(9).heightOfString(SLIDER_QUESTIONS[i], { width: CW - 28 });
      const boxH = Math.max(72, 14 + 16 + qH + 18 + 10);
      needPage(boxH + 8);
      doc.rect(ML, y, CW, boxH).fill(BG);
      doc.rect(ML, y, 3, boxH).fill(ACCENT);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(SLIDERS[i].label, ML + 12, y + 10);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text(SLIDER_QUESTIONS[i], ML + 12, y + 26, { width: CW - 28 });
      const textY = y + 26 + qH + 6;
      doc.fillColor(ACCENT).font('Helvetica-Oblique').fontSize(10).text(sentence, ML + 12, textY);
      const barY = textY + 16;
      doc.rect(ML + 12, barY, CW - 28, 3).fill('#D3D1C7');
      doc.rect(ML + 12, barY, ((val / 6) * (CW - 28)), 3).fill(ACCENT);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(7)
         .text(SLIDERS[i].left, ML + 12, barY + 5)
         .text(SLIDERS[i].right, ML + 12, barY + 5, { width: CW - 28, align: 'right' });
      y += boxH + 6;
    });

    y += 6;

    cv.forEach((val, i) => {
      const qH = doc.font('Helvetica').fontSize(9).heightOfString(CHOICE_QUESTIONS[i], { width: CW - 28 });
      const boxH = Math.max(56, 14 + 16 + qH + 16);
      needPage(boxH + 8);
      doc.rect(ML, y, CW, boxH).fill(BG);
      doc.rect(ML, y, 3, boxH).fill(GREEN);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(CHOICE_LABELS[i], ML + 12, y + 10);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text(CHOICE_QUESTIONS[i], ML + 12, y + 26, { width: CW - 28 });
      const ansY = y + 26 + qH + 6;
      doc.fillColor(GLIGHT).font('Helvetica-Bold').fontSize(10).text(`Selected: ${val || 'N/A'}`, ML + 12, ansY);
      y += boxH + 6;
    });

    y += 16;

    needPage(32);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15).text('Strategic Takeaways & Behavioral Clashes', ML, y);
    doc.rect(ML, y + 19, 36, 2).fill(ORANGE);
    y += 32;

    const clashes = detectClashes(sv, cv);

    if (clashes.length === 0) {
      const noClashText = 'Your scores indicate a high degree of harmony between your strategic ambitions and your cultural infrastructure. You are avoiding the common traps of "performative empowerment" or "management by spreadsheet." However, alignment is not a destination; it requires constant maintenance as you scale. Your next step is to look at these baselines and identify which single trait you can leverage as your "superpower" to accelerate growth in the next quarter.';
      const ncH = doc.font('Helvetica').fontSize(10).heightOfString(noClashText, { width: CW - 28, lineGap: 2 }) + 46;
      needPage(ncH + 8);
      doc.rect(ML, y, CW, ncH).fill(GBG);
      doc.rect(ML, y, 3, ncH).fill(GBORD);
      doc.fillColor(GDARK).font('Helvetica-Bold').fontSize(12).text('The Takeaway: Foundational Alignment', ML + 12, y + 12);
      doc.fillColor(GBORD).font('Helvetica').fontSize(10).text(noClashText, ML + 12, y + 30, { width: CW - 28, lineGap: 2 });
      y += ncH + 10;
    } else {
      clashes.forEach((clash, ci) => {
        const clashH = doc.font('Helvetica').fontSize(10).heightOfString(clash.text, { width: CW - 28, lineGap: 2 }) + 42;
        needPage(clashH + 10);
        doc.rect(ML, y, CW, clashH).fill(OPALE);
        doc.rect(ML, y, 3, clashH).fill(ORANGE);
        doc.fillColor(ODARK).font('Helvetica-Bold').fontSize(11).text(`${ci + 1}. ${clash.title}`, ML + 12, y + 12);
        doc.fillColor(OMID).font('Helvetica').fontSize(10).text(clash.text, ML + 12, y + 28, { width: CW - 28, lineGap: 2 });
        y += clashH + 10;
      });
    }

    y += 14;

    const ctaBody = 'Identifying your alignment baseline is only step one. The real work is translating these insights into operational behavior change. We help leadership teams unpack their specific alignment traits and identify the critical few behaviors needed to drive their strategy forward without burning out their people.';
    const ctaH = doc.font('Helvetica').fontSize(10).heightOfString(ctaBody, { width: CW - 28, lineGap: 2 }) + 60;
    needPage(ctaH);
    doc.rect(ML, y, CW, ctaH).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text('What Do These Scores Mean for Your Team?', ML + 14, y + 14);
    doc.font('Helvetica').fontSize(10).text(ctaBody, ML + 14, y + 34, { width: CW - 28, lineGap: 2 });
    const ctaLinkY = y + 34 + doc.font('Helvetica').fontSize(10).heightOfString(ctaBody, { width: CW - 28, lineGap: 2 }) + 10;
    doc.font('Helvetica-Bold').fontSize(11).text('>> Click Here to Schedule Your Culture Strategy Consultation', ML + 14, ctaLinkY);

    const totalPages = doc.bufferedPageRange().count;
    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(8).text(`Culture Alignment Demo Assessment  ·  Confidential  ·  Page ${p + 1} of ${totalPages}`, ML, 756, { width: CW });
    }

    doc.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let data;

    // Accept either rawRequest string (from Make) or direct fields (from manual tool)
    if (req.body.rawRequest) {
      data = parseRawRequest(req.body.rawRequest);
    } else {
      data = req.body;
    }

    const { name = 'Respondent' } = data;
    const filename = `reports/culture-alignment-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;

    const pdfBuffer = await generatePDF(data);

    const blob = await put(filename, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

   res.status(200).json({ success: true, url: blob.url, filename, email: data.email });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
