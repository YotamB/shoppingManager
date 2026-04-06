"""
shopping_add.py — add item to the right shopping list
Usage: python3 shopping_add.py "חלב" [--store leket|shufersal]
Returns JSON with result + updated list
"""
import json
import sys
import os
import argparse
from datetime import datetime
from shopping_router import route

WORKSPACE = os.path.dirname(__file__)
LIST_PATH = os.path.join(WORKSPACE, 'shopping_list.json')

def load_list():
    try:
        return json.load(open(LIST_PATH, encoding='utf-8'))
    except Exception:
        return {'leket': [], 'shufersal': [], 'lastUpdated': None}

def save_list(data):
    data['lastUpdated'] = datetime.now().isoformat()
    json.dump(data, open(LIST_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

def add_item(item_name, store, qty=1, note=''):
    lists = load_list()
    entry = {'name': item_name, 'qty': qty, 'added': datetime.now().strftime('%Y-%m-%d %H:%M'), 'note': note}
    
    # Avoid duplicates (case-insensitive)
    existing = [i for i in lists[store] if i['name'].strip().lower() == item_name.strip().lower()]
    if existing:
        existing[0]['qty'] += qty
        msg = f'עדכנתי כמות של "{item_name}" ב-{store} (כמות: {existing[0]["qty"]})'
    else:
        lists[store].append(entry)
        msg = f'הוספתי "{item_name}" לרשימת {store}'
    
    save_list(lists)
    return {'success': True, 'message': msg, 'store': store, 'list': lists[store]}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('item', nargs='+')
    parser.add_argument('--store', choices=['leket', 'shufersal'], default=None)
    parser.add_argument('--qty', type=float, default=1)
    args = parser.parse_args()
    
    item_name = ' '.join(args.item)
    
    if args.store:
        result = add_item(item_name, args.store, args.qty)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        routing = route(item_name)
        store = routing['store']
        
        if store == 'ask':
            print(json.dumps({
                'success': False,
                'store': 'ask',
                'message': f'לא מצאתי את "{item_name}" בלקט או בשופרסל. לאיזו רשימה להוסיף?',
                'routing': routing,
            }, ensure_ascii=False, indent=2))
        elif store == 'both':
            # Default to leket for fresh items, unless user specifies
            result = add_item(item_name, 'leket', args.qty)
            result['routing'] = routing
            result['note'] = 'נמצא בשניהם — הוספתי ללקט (ברירת מחדל)'
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            result = add_item(item_name, store, args.qty)
            result['routing'] = routing
            print(json.dumps(result, ensure_ascii=False, indent=2))
