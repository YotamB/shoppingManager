"""
shopping_alerts_notify.py
Runs shopping_alerts, formats a concise Discord message, prints it.
Used by cron job — output is piped to Discord by the agent.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from shopping_alerts import analyze_store, load_orders, TODAY, THRESHOLD, MIN_ORDERS, MIN_GAP_DAYS, MAX_OVERDUE_MULTIPLIER
import os

WORKSPACE = os.path.dirname(__file__)

def run():
    all_items = {}
    for store, path in [
        ('shufersal', os.path.join(WORKSPACE, 'shufersal', 'data', 'parsed_orders.json')),
        ('leket',     os.path.join(WORKSPACE, 'leket', 'parsed_orders.json')),
    ]:
        parsed = load_orders(path)
        all_items.update(analyze_store(store, parsed))

    alerts = sorted(
        [i for i in all_items.values() if i['alert'] and i['overdue_days'] > 0],
        key=lambda x: -x['urgency_pct']
    )[:10]

    approaching = sorted(
        [i for i in all_items.values() if i['alert'] and i['overdue_days'] <= 0],
        key=lambda x: x['overdue_days']
    )[:5]

    if not alerts and not approaching:
        print("QUIET")
        return

    lines = ["🛍️ **בדיקת מלאי שבועית**\n"]

    if alerts:
        lines.append(f"⚠️ **{len(alerts)} מוצרים שהגיע הזמן לרכוש:**")
        for i in alerts:
            emoji = '🥬' if i['store'] == 'leket' else '🛒'
            lines.append(f"  {emoji} {i['name']} — כל {i['avg_gap_days']:.0f} ימים, לא קנית {i['days_since']} ימים")

    if approaching:
        lines.append(f"\n🔔 **מתקרבים (השבוע):**")
        for i in approaching:
            emoji = '🥬' if i['store'] == 'leket' else '🛒'
            days_left = round(-i['overdue_days'])
            lines.append(f"  {emoji} {i['name']} — עוד ~{days_left} ימים")

    lines.append(f"\nרשימת קניות: http://192.168.68.118:3100/list")
    print('\n'.join(lines))

if __name__ == '__main__':
    run()
