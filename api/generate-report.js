const PDFDocument = require('pdfkit');
const { put } = require('@vercel/blob');

// ─── Color Palette ───────────────────────────────────────────────────────────
const ACCENT  = '#3C3489';
const DARK    = '#1a1a2e';
const MID     = '#5F5E5A';
const LIGHT   = '#888780';
const BG      = '#F8F7F4';
const GREEN   = '#1D9E75';
const GLIGHT  = '#0F6E56';
const GDARK   = '#173404';
const ORANGE  = '#D85A30';
const OPALE   = '#FAECE7';
const ODARK   = '#4A1B0C';
const OMID    = '#993C1D';
const GBG     = '#EAF3DE';
const GBORD   = '#3B6D11';
const TRACK   = '#E5E3DE';

// ─── Slider & Choice Metadata ─────────────────────────────────────────────────
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

const CHOICE_LABELS   = ['Senior Leader Customer Engagement','Leadership Decision Driver','Frontline Employee Empowerment','Customer Data Usage'];
const CHOICE_QUESTIONS = [
  'How frequently do your senior leaders engage directly with real customers?',
  'What drives leadership decisions most often?',
  'How empowered are frontline employees to solve customer problems?',
  'How is customer data used across the organization?',
];

// ─── MCQ Score Maps ───────────────────────────────────────────────────────────
const MCQ_SCORES = {
  c1: { 'Rarely or never': 1, 'Only when complaints escalate': 2, 'Monthly observations or interviews': 3, 'Actively forecast and co-create with customers': 4 },
  c2: { 'Internal politics, founder legacy, or gut feel': 1, 'Historical performance or internal efficiency': 2, 'Customer feedback and KPIs': 3, 'Future relevance and emerging customer needs': 4 },
  c3: { 'Require manager approval for everything': 1, 'Limited decision rights': 2, 'Can act within clear guidelines': 3, 'Fully trusted to act on behalf of the customer': 4 },
  c4: { 'Collected but not acted upon': 1, 'Reviewed occasionally in silos': 2, 'Reviewed monthly with action plans': 3, 'Integrated into daily dashboards and product decisions': 4 },
};

function getMCQScore(key, value) { return MCQ_SCORES[key][value] || 1; }

// ─── Slider Decay Scoring ─────────────────────────────────────────────────────
function sliderScore(val, target) {
  if (target === 'left')   { if (val === 0) return 3; if (val === 1) return 2; if (val === 2) return 1; return 0; }
  if (target === 'middle') { if (val === 3) return 3; if (val === 2 || val === 4) return 2; return 0; }
  if (target === 'right')  { if (val === 6) return 3; if (val === 5) return 2; if (val === 4) return 1; return 0; }
  return 0;
}

// ─── BFC + Leader Scores ──────────────────────────────────────────────────────
function calcScores(sv, cv) {
  const [s1, s2, s3, s4, s5, s6] = sv;
  const mc1 = getMCQScore('c1', cv[0]);
  const mc2 = getMCQScore('c2', cv[1]);
  const mc3 = getMCQScore('c3', cv[2]);
  const mc4 = getMCQScore('c4', cv[3]);

  const leaderScore = mc1 + mc2 + mc3 + mc4;

  const rawBetter  = sliderScore(s2,'left') + sliderScore(s3,'left') + sliderScore(s4,'right') + sliderScore(s5,'left') + sliderScore(s6,'middle') + mc1 + mc2 + mc4;
  const rawFaster  = sliderScore(s1,'right') + sliderScore(s4,'middle') + sliderScore(s5,'middle') + sliderScore(s6,'right') + mc3;
  const mc2_cheaper = 5 - mc2; // inverts c2: politics=4, historical=3, feedback=2, future=1
const rawCheaper = sliderScore(s2,'right') + sliderScore(s3,'left') + sliderScore(s4,'left') + sliderScore(s5,'right') + sliderScore(s6,'left') + mc2_cheaper;

  return {
    leaderScore,
    better:  Math.round((rawBetter  / 27) * 100),
    faster:  Math.round((rawFaster  / 16) * 100),
    cheaper: Math.round((rawCheaper / 19) * 100),
  };
}

function getLeaderType(score) {
  if (score >= 13) return { type: 'Customer-Driven',   color: GREEN,  text: 'You are Customer-driven. Stay sharp with predictive thinking and embedded leadership rituals. Maintain forecasting rituals. Codify empowerment into training. Embed customer metrics into daily dashboards. Celebrate proactive service wins and learn how to stay customer-driven.' };
  if (score >= 10) return { type: 'Customer-Centric',  color: ACCENT, text: 'You are likely Customer-centric. Solid strategy in place — now institutionalize systems and habits. Turn data into action cycles. Add OKRs tied to customer outcomes rather than scores tied to bonuses. Embed customer insights into strategy development.' };
  if (score >= 7)  return { type: 'Customer-Tolerant', color: ORANGE, text: 'You are likely Customer-tolerant. Focus on accountability, speed to action, and creating customer ownership. Close feedback loops within 30 days. Tie NPS/CSAT to executive OKRs. Empower a Chief Experience Officer to own CX end-to-end.' };
  return                  { type: 'Customer-Avoidant', color: '#B02020', text: 'You are likely in the Customer-avoidant zone. Start by building empathy, accountability, and basic customer systems.' };
}

// ─── Clash Detection ──────────────────────────────────────────────────────────
function detectClashes(sv, cv) {
  const [s1, s2, s3, s4, s5, s6] = sv;
  const [c1, c2, c3, c4] = cv;
  const lo = v => v <= 2, hi = v => v >= 4;
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

// ─── Parse Jotform rawRequest ─────────────────────────────────────────────────
function parseRawRequest(rawStr) {
  const raw = JSON.parse(rawStr);
  const nameObj = raw.q3_q3_fullname1 || {};
  return {
    name:    (`${nameObj.first || ''} ${nameObj.last || ''}`).trim() || 'Respondent',
    email:   raw.q4_q4_email2 || '',
    company: raw.q5_q5_textbox3 || 'Your Organization',
    s1: raw.q7_q7_scale5,  s2: raw.q8_q8_scale6,  s3: raw.q9_q9_scale7,
    s4: raw.q10_q10_scale8, s5: raw.q11_q11_scale9, s6: raw.q12_q12_scale10,
    c1: raw.q14_q14_radio12, c2: raw.q15_q15_radio13,
    c3: raw.q16_q16_radio14, c4: raw.q17_q17_radio15,
  };
}

function getSliderSentence(idx, val) {
  const t = SLIDER_TEXT[idx][val];
  return val === 3 ? `Your score indicates ${t}.` : `Your score indicates a ${t}.`;
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const { name = 'Respondent', company = 'Your Organization', s1, s2, s3, s4, s5, s6, c1, c2, c3, c4 } = data;
    const sv = [s1, s2, s3, s4, s5, s6].map(Number);
    const cv = [c1, c2, c3, c4];

    const scores    = calcScores(sv, cv);
    const leader    = getLeaderType(scores.leaderScore);
    const clashes   = detectClashes(sv, cv);

    const doc = new PDFDocument({ size: 'LETTER', margin: 56, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const CW = 500, ML = 56;
    let y = 0;

    function needPage(h) { if (y + h > 730) { doc.addPage(); y = 56; } }

    // ── Cover band ──
    doc.rect(0, 0, 612, 115).fill(ACCENT);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(22).text('Customer-Driven Leader Assessment', ML, 28, { width: CW });
    doc.font('Helvetica').fontSize(11).text('Preliminary Insights Report', ML, 60);
    doc.fontSize(10).text(`${name}  ·  ${company}`, ML, 76);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.6)').text(
      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), ML, 95
    );
    y = 130;

    // ── Intro preamble ──
    const preamble = "Thanks for completing the Customer-Driven Leader Assessment. Here are some initial insights below based on your answers. We've also included your detailed responses in the appendix below if you'd like to refer back to them.";
    const preambleH = doc.font('Helvetica').fontSize(10).heightOfString(preamble, { width: CW - 28, lineGap: 2 }) + 28;
    needPage(preambleH + 8);
    doc.rect(ML, y, CW, preambleH).fill(BG);
    doc.fillColor(MID).font('Helvetica').fontSize(10).text(preamble, ML + 14, y + 14, { width: CW - 28, lineGap: 2 });
    y += preambleH + 16;

    // ── Leader Type ──
    needPage(110);
    const leaderTextH = doc.font('Helvetica').fontSize(10).heightOfString(leader.text, { width: CW - 28, lineGap: 2 });
    const leaderBoxH  = Math.max(80, 14 + 24 + leaderTextH + 18);
    doc.rect(ML, y, CW, leaderBoxH).fill(BG);
    doc.rect(ML, y, 4, leaderBoxH).fill(leader.color);
    doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text('YOUR LEADER TYPE', ML + 14, y + 12);
    doc.fillColor(leader.color).font('Helvetica-Bold').fontSize(16).text(leader.type, ML + 14, y + 26);
    doc.fillColor(MID).font('Helvetica').fontSize(10).text(leader.text, ML + 14, y + 48, { width: CW - 28, lineGap: 2 });
    y += leaderBoxH + 14;

    // ── BFC Thermometers ──
    needPage(170);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15).text('Your Culture Metrics', ML, y);
    doc.rect(ML, y + 19, 36, 2).fill(ACCENT);
    y += 32;

    const metrics = [
      { label: 'BETTER',  score: scores.better,  color: ACCENT, tagline: 'Customer-led thinking & insight quality' },
      { label: 'FASTER',  score: scores.faster,  color: GREEN,  tagline: 'Speed of decision-making & execution' },
      { label: 'CHEAPER', score: scores.cheaper, color: ORANGE, tagline: 'Operational efficiency & cost mindset' },
    ];

    const barW = CW - 28;
    const barH = 20;
    const mBoxH = metrics.length * (14 + 16 + barH + 14) + 28;
    needPage(mBoxH);
    doc.rect(ML, y, CW, mBoxH).fill(BG);

    let my = y + 14;
    metrics.forEach(m => {
      const pct = m.score / 100;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(m.label, ML + 14, my);
      doc.fillColor(m.color).font('Helvetica-Bold').fontSize(11).text(`${m.score}/100`, ML + 14, my, { width: barW, align: 'right' });
      my += 16;
      doc.rect(ML + 14, my, barW, barH).fill(TRACK);
      if (pct > 0) doc.rect(ML + 14, my, Math.max(barH, barW * pct), barH).fill(m.color);
      my += barH + 4;
      doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text(m.tagline, ML + 14, my);
      my += 14;
    });

    y += mBoxH + 16;

    // ── Strategic Takeaways ──
    needPage(32);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15).text('Strategic Takeaways', ML, y);
    doc.rect(ML, y + 19, 36, 2).fill(ORANGE);
    y += 32;

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

    // ── CTA ──
    const ctaBody = 'Identifying your alignment baseline is only step one. The real work is translating these insights into operational behavior change. We help leadership teams unpack their specific alignment traits and identify the critical few behaviors needed to drive their strategy forward without burning out their people.';
    const ctaLink = 'Please click here if you would like to discuss your survey results, or how to leverage this assessment across your broader leadership team.';
    const ctaBodyH = doc.font('Helvetica').fontSize(10).heightOfString(ctaBody, { width: CW - 28, lineGap: 2 });
    const ctaLinkH = doc.font('Helvetica-Bold').fontSize(10).heightOfString(ctaLink, { width: CW - 28, lineGap: 2 });
    const ctaBoxH  = ctaBodyH + ctaLinkH + 60;
    needPage(ctaBoxH);
    doc.rect(ML, y, CW, ctaBoxH).fill(ACCENT);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13).text('What Do These Scores Mean for Your Team?', ML + 14, y + 14);
    doc.font('Helvetica').fontSize(10).text(ctaBody, ML + 14, y + 34, { width: CW - 28, lineGap: 2 });
    const linkY = y + 34 + ctaBodyH + 12;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
       .text(ctaLink, ML + 14, linkY, { width: CW - 28, lineGap: 2, link: 'https://www.lxaccelerator.net/contact-us', underline: true });

    y += ctaBoxH + 24;

    // ── Appendix ──
    needPage(40);
    doc.rect(0, y, 612, 36).fill('#2a2548');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13).text('Appendix: Your Detailed Survey Responses', ML, y + 10);
    y += 50;

    // Slider response cards
    sv.forEach((val, i) => {
      const sentence = getSliderSentence(i, val);
      const qH = doc.font('Helvetica').fontSize(9).heightOfString(SLIDER_QUESTIONS[i], { width: CW - 28 });
      const boxH = Math.max(72, 14 + 16 + qH + 22 + 14);
      needPage(boxH + 8);
      doc.rect(ML, y, CW, boxH).fill(BG);
      doc.rect(ML, y, 3, boxH).fill(ACCENT);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(SLIDERS[i].label, ML + 12, y + 10);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text(SLIDER_QUESTIONS[i], ML + 12, y + 26, { width: CW - 28 });
      const textY = y + 26 + qH + 6;
      doc.fillColor(ACCENT).font('Helvetica-Oblique').fontSize(10).text(sentence, ML + 12, textY);
      const bY = textY + 16;
      doc.rect(ML + 12, bY, CW - 28, 3).fill(TRACK);
      doc.rect(ML + 12, bY, ((val / 6) * (CW - 28)), 3).fill(ACCENT);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(7)
         .text(SLIDERS[i].left, ML + 12, bY + 5)
         .text(SLIDERS[i].right, ML + 12, bY + 5, { width: CW - 28, align: 'right' });
      y += boxH + 6;
    });

    y += 6;

    // Choice response cards
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

// Trim trailing blank pages
while (doc.bufferedPageRange().count > 1) {
  const total = doc.bufferedPageRange().count;
  doc.switchToPage(total - 1);
  if (doc.y < 150) {
    doc._pageBuffer.pop();
  } else {
    break;
  }
}

// Add footers
doc.flushPages();
const totalPages = doc.bufferedPageRange().count;
for (let p = 0; p < totalPages; p++) {
  doc.switchToPage(p);
  doc.fillColor(LIGHT).font('Helvetica').fontSize(8)
     .text(`Customer-Driven Leader Assessment  ·  Confidential  ·  Page ${p + 1} of ${totalPages}`, ML, 756, { width: CW });
}

doc.end();
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body.rawRequest ? parseRawRequest(req.body.rawRequest) : req.body;
    const { name = 'Respondent', email = '' } = data;
    const filename = `reports/culture-alignment-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
    const pdfBuffer = await generatePDF(data);
    const blob = await put(filename, pdfBuffer, { access: 'public', contentType: 'application/pdf' });
    res.status(200).json({ success: true, url: blob.url, filename, email });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
