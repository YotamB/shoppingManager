"""
Parse shufersal orders.json into parsed_orders.json (same format as leket)
"""
import json
from collections import Counter, defaultdict
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
orders_raw = json.load(open(os.path.join(DATA_DIR, 'orders.json')))

SKIP_NAMES = {'דמי משלוח', 'משלוח', ''}

item_counter = Counter()
item_orders = defaultdict(list)
parsed_orders = []

for order in orders_raw:
    code = order.get('code') or order.get('orderCode', '?')
    date_str = (order.get('createdString') or order.get('created', ''))[:10]
    total = (order.get('totalPriceWithTax') or {}).get('formattedValue', '')
    entries = order.get('entries') or []

    items = []
    for entry in entries:
        prod = entry.get('product') or {}
        name = prod.get('name', '').strip()
        qty = entry.get('quantity', 0)
        price = (entry.get('basePrice') or {}).get('formattedValue', '')
        total_entry = (entry.get('totalPrice') or {}).get('formattedValue', '')

        if not name or name in SKIP_NAMES or qty <= 0:
            continue

        # Shufersal uses grams for weight items — convert to kg
        unit_code = ((entry.get('unit') or {}) or (prod.get('unit') or {}))
        if isinstance(unit_code, dict):
            unit_code = unit_code.get('code', '')
        display_qty = qty
        display_unit = "יח'"
        if unit_code == 'KG' and qty > 100:
            display_qty = round(qty / 1000, 2)
            display_unit = 'ק"ג'
        elif unit_code == 'KG':
            display_unit = 'ק"ג'

        items.append({'name': name, 'qty': display_qty, 'unit': display_unit, 'price': price, 'total': total_entry})
        item_counter[name] += display_qty
        item_orders[name].append(code)

    parsed_orders.append({
        'num': code,
        'date': date_str,
        'total': total,
        'items': items,
        'item_count': len(items)
    })

print(f'Parsed {len(parsed_orders)} orders, {len(item_counter)} unique items')
print('\nTop 20:')
for name, qty in item_counter.most_common(20):
    count = len(item_orders[name])
    print(f'  {name}: {qty:.1f} units across {count} orders')

result = {
    'orders': parsed_orders,
    'item_summary': [
        {'name': k, 'total_qty': round(v, 2), 'num_orders': len(item_orders[k])}
        for k, v in item_counter.most_common()
    ]
}

out = os.path.join(DATA_DIR, 'parsed_orders.json')
json.dump(result, open(out, 'w'), ensure_ascii=False, indent=2)
print(f'\nSaved to {out}')
