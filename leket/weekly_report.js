/**
 * weekly_report.js
 * Smart Leket – Weekly Sunday report
 * 1. Scans catalog
 * 2. Loads base list + memory from Notion
 * 3. Creates weekly Notion report page
 * 4. Returns URL for Discord notification
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { checkDeliveryWeek } = require('./holidays');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));
const TOKEN = CONFIG.notion_token;
const HUB_ID = CONFIG.hub_page_id;
const BASE_DB_ID = CONFIG.base_list_db_id;
const MEMORY_DB_ID = CONFIG.memory_db_id;
const CATALOG_DB_ID = CONFIG.catalog_db_id;

// ---- Notion API ----
function notionApi(method, endpoint, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function queryDb(dbId, filter) {
  const body = filter ? { filter } : {};
  const res = await notionApi('POST', `databases/${dbId}/query`, body);
  return res.results || [];
}

function getTitle(page) {
  for (const key of Object.keys(page.properties)) {
    const prop = page.properties[key];
    if (prop.type === 'title') return prop.title.map(t => t.plain_text).join('');
  }
  return '';
}

function getProp(page, key) {
  const prop = page.properties[key];
  if (!prop) return null;
  if (prop.type === 'number') return prop.number;
  if (prop.type === 'checkbox') return prop.checkbox;
  if (prop.type === 'select') return prop.select?.name || null;
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('');
  if (prop.type === 'date') return prop.date?.start || null;
  return null;
}

// ---- Block helpers ----
const bP = text => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: String(text).slice(0, 2000) } }] } });
const bH2 = text => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: text } }] } });
const bH3 = text => ({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: text } }] } });
const bCallout = (text, emoji, color) => ({ object: 'block', type: 'callout', callout: { rich_text: [{ type: 'text', text: { content: String(text).slice(0, 2000) } }], icon: { emoji }, color } });
const bDivider = () => ({ object: 'block', type: 'divider', divider: {} });
const bBullet = text => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: String(text).slice(0, 2000) } }] } });

// ---- Main ----
async function run() {
  const today = new Date();
  const isoDate = today.toISOString().split('T')[0];

  // Find this Sunday (or today if Sunday)
  const dayOfWeek = today.getDay();
  const sundayOffset = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() + sundayOffset);
  const sundayStr = thisSunday.toISOString().split('T')[0];

  // Check holiday status
  const holidayCheck = checkDeliveryWeek(sundayStr);
  const heDate = today.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  console.log(`\n🥬 Smart Leket Weekly Report – ${heDate}`);

  // 1. Load catalog
  let catalog = { items: [], scannedAt: null };
  const catalogFile = path.join(__dirname, 'catalog_latest.json');
  if (fs.existsSync(catalogFile)) {
    catalog = JSON.parse(fs.readFileSync(catalogFile));
    const age = (Date.now() - new Date(catalog.scannedAt)) / 3600000;
    console.log(`📦 Catalog: ${catalog.items.length} items (${age.toFixed(1)}h ago)`);
    if (age > 12) {
      console.log('  → Running fresh scan...');
      const { run: scanRun } = require('./scan_catalog');
      catalog = await scanRun();
    }
  } else {
    console.log('📦 No catalog – running scan...');
    const { run: scanRun } = require('./scan_catalog');
    catalog = await scanRun();
  }

  const catalogMap = new Map(catalog.items.map(i => [i.name, i]));

  // 2. Load base list
  console.log('📋 Loading base list...');
  const baseItems = await queryDb(BASE_DB_ID, { property: 'פעיל', checkbox: { equals: true } });
  console.log(`  → ${baseItems.length} active items`);

  // 3. Load memory
  console.log('🧠 Loading memory notes...');
  const memoryItems = await queryDb(MEMORY_DB_ID, { property: 'מצב', select: { equals: '⏳ בהמתנה' } });
  console.log(`  → ${memoryItems.length} active notes`);

  // Build memory lookup
  const memoryMap = new Map();
  for (const m of memoryItems) {
    const name = getTitle(m);
    memoryMap.set(name, {
      note: getProp(m, 'הערה') || '',
      until: getProp(m, 'לא להזמין עד') || '',
    });
  }

  // 3b. Holiday warning blocks
  const holidayBlocks = [];
  if (!holidayCheck.ok) {
    holidayBlocks.push(bCallout(holidayCheck.message, '⚠️', 'red_background'));
  } else if (holidayCheck.message) {
    holidayBlocks.push(bCallout(holidayCheck.message, '🗓️', 'yellow_background'));
  }

  // 4. Load previous catalog for "new items" detection
  const prevCatalogFile = path.join(__dirname, 'catalog_prev.json');
  const prevCatalog = fs.existsSync(prevCatalogFile)
    ? JSON.parse(fs.readFileSync(prevCatalogFile))
    : { items: [] };
  const prevNames = new Set(prevCatalog.items.map(i => i.name));

  // 5. Build report sections
  const baseListLines = [];
  const waitingLines = [];
  const missingLines = [];

  for (const item of baseItems) {
    const name = getTitle(item);
    const qty = getProp(item, 'כמות ברירת מחדל') || 1;
    const unit = getProp(item, 'יחידה') || '';
    const avg = getProp(item, 'ממוצע היסטורי') || qty;
    const inCatalog = catalogMap.get(name);
    const memory = memoryMap.get(name);

    if (memory) {
      const untilStr = memory.until ? ` (עד ${memory.until})` : '';
      waitingLines.push(`⏸️ ${name} – ${memory.note}${untilStr}`);
      continue;
    }

    if (!inCatalog || !inCatalog.available) {
      missingLines.push(`❌ ${name} – לא זמין כרגע. ממוצע שלך: ${avg} ${unit}`);
      continue;
    }

    baseListLines.push(`${name} × ${qty} ${unit} | ${inCatalog.price || ''}`);
  }

  // New items this week (in catalog but not in prev catalog, and not in base list)
  const baseNames = new Set(baseItems.map(i => getTitle(i)));
  const newItems = catalog.items.filter(i =>
    !prevNames.has(i.name) && !baseNames.has(i.name)
  ).slice(0, 15);

  // 6. Estimate total (rough)
  const pricePattern = /[\d.]+/;
  let estimatedTotal = 0;
  for (const item of baseItems) {
    const name = getTitle(item);
    const qty = getProp(item, 'כמות ברירת מחדל') || 1;
    const catalogItem = catalogMap.get(name);
    if (catalogItem?.price) {
      const match = catalogItem.price.match(pricePattern);
      if (match) estimatedTotal += parseFloat(match[0]) * qty;
    }
  }
  estimatedTotal += 20; // delivery

  // 7. Build Notion page blocks
  const blocks = [
    bCallout(
      `דוח שבועי ל-${heDate}\n${baseListLines.length} פריטים בסיס | ${newItems.length} פריטים חדשים | ${waitingLines.length} בהמתנה\nממתין לאישורך 👇`,
      '🥬', 'green_background'
    ),
    ...holidayBlocks,
    bDivider(),
    bH2('📋 רשימת הזמנה'),
    ...baseListLines.map(l => bBullet(l)),
  ];

  if (waitingLines.length > 0) {
    blocks.push(bDivider());
    blocks.push(bH2('⏸️ בהמתנה (לא להזמין)'));
    waitingLines.forEach(l => blocks.push(bBullet(l)));
  }

  if (missingLines.length > 0) {
    blocks.push(bDivider());
    blocks.push(bH2('⚠️ חסר / לא זמין'));
    missingLines.forEach(l => blocks.push(bBullet(l)));
    blocks.push(bP('💡 ניתן להוסיף תחלופה ידנית – כתוב לי בדיסקורד'));
  }

  if (newItems.length > 0) {
    blocks.push(bDivider());
    blocks.push(bH2('🆕 חדש השבוע / לא הזמנת מעולם'));
    newItems.forEach(i => blocks.push(bBullet(`${i.name} | ${i.price} | ${i.category}`)));
  }

  blocks.push(bDivider());
  blocks.push(bH2('✅ אישור'));
  if (estimatedTotal > 20) {
    blocks.push(bP(`הערכת סכום: ~${Math.round(estimatedTotal)} ₪ (כולל משלוח)`));
  }
  blocks.push(bCallout(
    'כתוב לי בדיסקורד:\n• "אשר" – לשלוח כפי שהיא\n• "ערוך: [שינויים]" – לעדכן ולאשר שוב\n• "הוסף [פריט]" – להוסיף לרשימה\n• "הסר [פריט]" – להוריד מהרשימה\n• "זכור: [פריט] [הערה]" – לשמור הערה בזיכרון\n• "בטל השבוע" – לדלג',
    '👆', 'yellow_background'
  ));

  // 8. Create Notion page
  console.log('\n📄 Creating report page...');
  const reportPage = await notionApi('POST', 'pages', {
    parent: { page_id: HUB_ID },
    icon: { emoji: '📅' },
    properties: {
      title: { title: [{ text: { content: `📅 דוח שבועי – ${isoDate}` } }] }
    },
    children: blocks
  });

  const url = reportPage.url;
  console.log(`✅ Report: ${url}`);

  // 9. Save latest report + rotate catalog
  fs.writeFileSync(path.join(__dirname, 'latest_report.json'), JSON.stringify({ url, date: isoDate }, null, 2));
  if (fs.existsSync(catalogFile)) {
    fs.copyFileSync(catalogFile, prevCatalogFile);
  }

  return url;
}

module.exports = { run };

if (require.main === module) {
  run().then(url => {
    console.log('\nDone. URL:', url);
  }).catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
