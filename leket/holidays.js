/**
 * holidays.js
 * Israeli holiday awareness for Smart Leket
 * 
 * Logic:
 * - Delivery day = Monday (יום שני)
 * - If Monday is a holiday or holiday-eve → delivery blocked
 * - Need to find next available delivery day or previous one
 * - Also check if upcoming week has extended holidays (פסח, סוכות) → suggest larger quantities
 */

// Israeli holidays 2025-2027 (eve + holiday dates)
// Format: { name, eve: "YYYY-MM-DD", start: "YYYY-MM-DD", end: "YYYY-MM-DD", extended: bool }
const HOLIDAYS = [
  // 2025
  { name: "ראש השנה תשפ\"ו",    eve: "2025-09-22", start: "2025-09-22", end: "2025-09-24", extended: false },
  { name: "יום כיפור תשפ\"ו",   eve: "2025-10-01", start: "2025-10-01", end: "2025-10-02", extended: false },
  { name: "סוכות תשפ\"ו",       eve: "2025-10-06", start: "2025-10-06", end: "2025-10-14", extended: true  },
  { name: "חנוכה תשפ\"ו",       eve: null,         start: "2025-12-14", end: "2025-12-22", extended: false }, // delivery ok

  // 2026
  { name: "פורים תשפ\"ו",       eve: "2026-03-02", start: "2026-03-03", end: "2026-03-03", extended: false },
  { name: "פסח תשפ\"ו",         eve: "2026-04-01", start: "2026-04-01", end: "2026-04-08", extended: true  },
  { name: "יום הזיכרון תשפ\"ו", eve: "2026-04-20", start: "2026-04-20", end: "2026-04-21", extended: false },
  { name: "יום העצמאות תשפ\"ו", eve: "2026-04-21", start: "2026-04-21", end: "2026-04-22", extended: false },
  { name: "ל\"ג בעומר תשפ\"ו",  eve: "2026-05-04", start: "2026-05-04", end: "2026-05-05", extended: false },
  { name: "שבועות תשפ\"ו",      eve: "2026-05-21", start: "2026-05-21", end: "2026-05-22", extended: false },
  { name: "תשעה באב תשפ\"ו",   eve: "2026-07-22", start: "2026-07-22", end: "2026-07-23", extended: false },

  // 2026-2027 (approximate, will update)
  { name: "ראש השנה תשפ\"ז",    eve: "2026-09-10", start: "2026-09-10", end: "2026-09-12", extended: false },
  { name: "יום כיפור תשפ\"ז",   eve: "2026-09-19", start: "2026-09-19", end: "2026-09-20", extended: false },
  { name: "סוכות תשפ\"ז",       eve: "2026-09-24", start: "2026-09-24", end: "2026-10-01", extended: true  },
];

/**
 * Check if a given date (YYYY-MM-DD string) is a holiday or holiday eve
 * for lekethasade (eve of holiday = closed, holiday = closed)
 */
function isClosedDay(dateStr) {
  for (const h of HOLIDAYS) {
    if (h.eve && dateStr === h.eve) return { closed: true, holiday: h.name, reason: 'ערב חג' };
    if (dateStr >= h.start && dateStr <= h.end) return { closed: true, holiday: h.name, reason: 'חג' };
  }
  return { closed: false };
}

/**
 * Check if delivery week has extended holidays nearby (פסח / סוכות)
 * that would mean the NEXT order is far away → suggest larger quantities
 */
function getExtendedHolidayWarning(sundayDate) {
  // Check the week of: Sunday → next 14 days
  const sun = new Date(sundayDate);
  for (let i = 0; i < 21; i++) {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    for (const h of HOLIDAYS) {
      if (h.extended && ds >= h.start && ds <= h.end) {
        return h;
      }
    }
  }
  return null;
}

/**
 * Given a Sunday order date, find the situation for the upcoming Monday delivery
 * Returns: { ok, blockedDate, holidayName, reason, suggestion, extendedHoliday }
 */
function checkDeliveryWeek(sundayStr) {
  const sunday = new Date(sundayStr);
  
  // Monday delivery = sunday + 1
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() + 1);
  const mondayStr = monday.toISOString().split('T')[0];
  
  const mondayStatus = isClosedDay(mondayStr);
  
  // Check extended holiday in next 3 weeks
  const extendedHoliday = getExtendedHolidayWarning(sundayStr);
  
  if (!mondayStatus.closed) {
    return {
      ok: true,
      mondayStr,
      extendedHoliday,
      message: extendedHoliday 
        ? `⚠️ שים לב: ${extendedHoliday.name} מתחיל בקרוב (${extendedHoliday.start}). שקול להגדיל כמויות לשבוע הזה כי ההזמנה הבאה עלולה לאחר.`
        : null
    };
  }
  
  // Monday is blocked — find nearest alternative
  // Try: the Sunday itself (same day delivery?), or Saturday, or advance to Tuesday/Wednesday
  // Strategy: order Thursday/Friday before → deliver before holiday
  // Find last delivery day BEFORE the holiday
  
  const alternatives = [];
  
  // Check days before the blocked Monday (going back from Saturday)
  for (let daysBack = 1; daysBack <= 5; daysBack++) {
    const altDay = new Date(monday);
    altDay.setDate(monday.getDate() - daysBack);
    const altStr = altDay.toISOString().split('T')[0];
    const altStatus = isClosedDay(altStr);
    if (!altStatus.closed) {
      const dayName = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][altDay.getDay()];
      alternatives.push({ date: altStr, dayName, direction: 'before', daysFromNow: -daysBack });
      break;
    }
  }
  
  // Check days after (deliver later this week)
  for (let daysAfter = 1; daysAfter <= 5; daysAfter++) {
    const altDay = new Date(monday);
    altDay.setDate(monday.getDate() + daysAfter);
    const altStr = altDay.toISOString().split('T')[0];
    const altStatus = isClosedDay(altStr);
    if (!altStatus.closed) {
      const dayName = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][altDay.getDay()];
      alternatives.push({ date: altStr, dayName, direction: 'after', daysFromNow: daysAfter });
      break;
    }
  }
  
  return {
    ok: false,
    mondayStr,
    holidayName: mondayStatus.holiday,
    reason: mondayStatus.reason,
    alternatives,
    extendedHoliday,
    message: buildHolidayMessage(mondayStatus, mondayStr, alternatives, extendedHoliday)
  };
}

function buildHolidayMessage(status, mondayStr, alternatives, extendedHoliday) {
  let msg = `⚠️ **התרעת חג: ${status.holiday}**\n`;
  msg += `יום שני ${mondayStr} הוא ${status.reason} — לקט השדה לא מספקים.\n\n`;
  
  if (alternatives.length > 0) {
    const before = alternatives.find(a => a.direction === 'before');
    const after = alternatives.find(a => a.direction === 'after');
    
    if (before) {
      msg += `📅 **אפשרות א':** להזמין עכשיו לקבלה ב${before.dayName} ${before.date} (לפני החג)\n`;
    }
    if (after) {
      msg += `📅 **אפשרות ב':** להזמין אחרי החג לקבלה ב${after.dayName} ${after.date}\n`;
    }
  }
  
  if (extendedHoliday) {
    msg += `\n🗓️ **חג ממושך (${extendedHoliday.name})**: שקול להגדיל כמויות בהזמנה שלפני החג, כי ההזמנה הבאה תהיה רק בעוד מספר שבועות.`;
  }
  
  return msg;
}

/**
 * Get holiday summary for the next N weeks
 */
function getUpcomingHolidayAlerts(fromDate, weeksAhead = 8) {
  const alerts = [];
  const from = new Date(fromDate);
  
  for (let week = 0; week < weeksAhead; week++) {
    // Find the Sunday of this week
    const sunday = new Date(from);
    sunday.setDate(from.getDate() + (week * 7));
    // Adjust to nearest Sunday
    const dayOfWeek = sunday.getDay();
    const daysToSunday = (7 - dayOfWeek) % 7;
    sunday.setDate(sunday.getDate() + daysToSunday);
    
    const sundayStr = sunday.toISOString().split('T')[0];
    const check = checkDeliveryWeek(sundayStr);
    
    if (!check.ok || check.extendedHoliday) {
      alerts.push({ week: week + 1, sundayStr, ...check });
    }
  }
  
  return alerts;
}

module.exports = { checkDeliveryWeek, getUpcomingHolidayAlerts, isClosedDay, HOLIDAYS };

// Test when run directly
if (require.main === module) {
  const today = new Date().toISOString().split('T')[0];
  console.log('🗓️ Upcoming holiday alerts (next 8 weeks from', today, '):\n');
  
  const alerts = getUpcomingHolidayAlerts(today, 12);
  if (alerts.length === 0) {
    console.log('No conflicts in the next 12 weeks');
  } else {
    for (const alert of alerts) {
      console.log(`Week ${alert.week} (ראשון ${alert.sundayStr}):`);
      console.log(alert.message || `✅ OK, but: ${alert.extendedHoliday?.name}`);
      console.log();
    }
  }
  
  // Check this coming Sunday
  const nextSunday = new Date();
  const daysUntilSunday = (7 - nextSunday.getDay()) % 7 || 7;
  nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
  const sundayStr = nextSunday.toISOString().split('T')[0];
  console.log(`\nChecking next order Sunday ${sundayStr}:`);
  const result = checkDeliveryWeek(sundayStr);
  console.log(JSON.stringify(result, null, 2));
}
