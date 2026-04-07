"""
shopping_alerts.py — per-product reorder alerts
Analyzes order history per item, computes average gap between purchases,
and flags items that are overdue (gap * threshold days since last purchase).

Usage:
  python3 shopping_alerts.py              → JSON list of alerts
  python3 shopping_alerts.py --summary    → human-readable summary
"""

import json
import os
import sys
import argparse
from datetime import datetime, date
from collections import defaultdict

WORKSPACE = os.path.dirname(__file__)
TODAY = date.today()

# How sensitive: alert when daysSinceLast >= avgGap * THRESHOLD
THRESHOLD = 0.75   # 75% of average gap = heads-up
MIN_ORDERS = 2     # need at least 2 purchases to detect a pattern
MIN_GAP_DAYS = 7   # ignore items bought more often than weekly (perishables)
MAX_OVERDUE_MULTIPLIER = 2.5  # if daysSinceLast > avg_gap * this, assume abandoned/stopped buying

HEBREW_MONTHS = {1:'ינואר',2:'פברואר',3:'מרץ',4:'אפריל',5:'מאי',6:'יוני',
                 7:'יולי',8:'אוגוסט',9:'ספטמבר',10:'אוקטובר',11:'נובמבר',12:'דצמבר'}


def parse_date(s):
    """Parse multiple date formats → date object or None."""
    if not s:
        return None
    s = s.strip()
    for fmt in ('%Y/%m/%d', '%d/%m/%y %H:%M', '%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s[:len(fmt.replace('%y','00').replace('%Y','0000'))], fmt).date()
        except ValueError:
            pass
    # Try just the first 10 chars
    for fmt in ('%Y/%m/%d', '%d/%m/%y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            pass
    return None


def load_orders(path):
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception:
        return None


def analyze_store(store_name, parsed):
    """Returns dict: item_name → {dates, avg_gap, last_date, days_since, alert}"""
    if not parsed:
        return {}

    # item → list of dates it was purchased
    item_dates = defaultdict(list)
    for order in parsed.get('orders', []):
        order_date = parse_date(order.get('date'))
        if not order_date:
            continue
        for item in order.get('items', []):
            name = item.get('name', '').strip()
            if not name:
                continue
            item_dates[name].append(order_date)

    results = {}
    for name, dates in item_dates.items():
        dates = sorted(set(dates))  # dedupe + sort
        if len(dates) < MIN_ORDERS:
            continue

        # Compute gaps between consecutive purchases
        gaps = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
        avg_gap = sum(gaps) / len(gaps)

        if avg_gap < MIN_GAP_DAYS:
            continue  # too frequent to be meaningful

        last_date = dates[-1]
        days_since = (TODAY - last_date).days

        # Skip items abandoned: if not bought in > avg_gap * MAX_OVERDUE_MULTIPLIER, stop alerting
        if days_since > avg_gap * MAX_OVERDUE_MULTIPLIER:
            continue

        overdue_days = days_since - avg_gap
        urgency_pct = days_since / avg_gap  # >1.0 = overdue

        alert = urgency_pct >= THRESHOLD

        results[name] = {
            'store': store_name,
            'name': name,
            'num_orders': len(dates),
            'avg_gap_days': round(avg_gap, 1),
            'last_date': last_date.isoformat(),
            'days_since': days_since,
            'overdue_days': round(overdue_days, 0),
            'urgency_pct': round(urgency_pct * 100),
            'alert': alert,
        }

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--summary', action='store_true')
    parser.add_argument('--all', action='store_true', help='show all items, not just alerts')
    parser.add_argument('--store', choices=['leket', 'shufersal', 'both'], default='both')
    args = parser.parse_args()

    all_items = {}

    if args.store in ('shufersal', 'both'):
        parsed = load_orders(os.path.join(WORKSPACE, 'shufersal', 'data', 'parsed_orders.json'))
        all_items.update(analyze_store('shufersal', parsed))

    if args.store in ('leket', 'both'):
        parsed = load_orders(os.path.join(WORKSPACE, 'leket', 'parsed_orders.json'))
        all_items.update(analyze_store('leket', parsed))

    # Filter
    items = list(all_items.values())
    if not args.all:
        items = [i for i in items if i['alert']]

    # Sort by urgency
    items.sort(key=lambda x: -x['urgency_pct'])

    if args.summary:
        if not items:
            print('✅ אין התראות כרגע — כל המוצרים בטווח הצפוי.')
            return

        overdue = [i for i in items if i['overdue_days'] > 0]
        approaching = [i for i in items if i['overdue_days'] <= 0]

        if overdue:
            print(f'⚠️  {len(overdue)} מוצרים שעבר הזמן לרכוש:\n')
            for i in overdue:
                store_emoji = '🥬' if i['store'] == 'leket' else '🛒'
                print(f'  {store_emoji} {i["name"]}')
                print(f'     קנית בממוצע כל {i["avg_gap_days"]:.0f} ימים · לא קנית {i["days_since"]} ימים ({abs(int(i["overdue_days"]))} ימים מאוחר)')
                print()

        if approaching:
            print(f'🔔  {len(approaching)} מוצרים מתקרבים לזמן הרכישה:\n')
            for i in approaching:
                store_emoji = '🥬' if i['store'] == 'leket' else '🛒'
                days_left = round(-i['overdue_days'])
                print(f'  {store_emoji} {i["name"]} — עוד ~{days_left} ימים (ממוצע: כל {i["avg_gap_days"]:.0f} ימים)')

    else:
        print(json.dumps(items, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
