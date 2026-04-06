"""
shopping_router.py
Decides which store (leket / shufersal / both / ask) a product belongs to.
Usage: python3 shopping_router.py "חלב"
Returns JSON: { "store": "leket"|"shufersal"|"both"|"ask", "matches": [...], "reason": "..." }
"""

import json
import sys
import os
import re

WORKSPACE = os.path.dirname(__file__)

def load_json(path):
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception:
        return None

def normalize(s):
    """Strip whitespace and common suffixes for fuzzy matching."""
    s = s.strip().lower()
    # Remove unit suffixes
    s = re.sub(r'\s*(ק"ג|קג|יח\'|ליטר|מל|גרם|ג\'|ק\.ג\.|kg)$', '', s).strip()
    return s

def fuzzy_match(query, name, threshold=0.6):
    """Returns True if query is a substring of name or vice versa, or high overlap."""
    q = normalize(query)
    n = normalize(name)
    if not q or not n:
        return False
    # Direct substring
    if q in n or n in q:
        return True
    # Word overlap
    qwords = set(q.split())
    nwords = set(n.split())
    if not qwords:
        return False
    overlap = len(qwords & nwords) / len(qwords)
    return overlap >= threshold

def search_leket(query):
    """Search leket catalog + order history."""
    matches = []
    
    # Current catalog
    catalog = load_json(os.path.join(WORKSPACE, 'leket', 'catalog_latest.json'))
    if catalog:
        for item in catalog.get('items', []):
            name = item.get('name', '')
            if fuzzy_match(query, name):
                matches.append({
                    'source': 'catalog',
                    'name': name,
                    'category': item.get('category', ''),
                    'price': item.get('price', ''),
                    'available': item.get('available', False),
                })
    
    # Order history (items we've actually bought)
    parsed = load_json(os.path.join(WORKSPACE, 'leket', 'parsed_orders.json'))
    if parsed:
        seen = {m['name'] for m in matches}
        for item in parsed.get('item_summary', []):
            name = item.get('name', '')
            if fuzzy_match(query, name) and name not in seen:
                matches.append({
                    'source': 'history',
                    'name': name,
                    'num_orders': item.get('num_orders', 0),
                    'total_qty': item.get('total_qty', 0),
                })
    
    return matches

def search_shufersal(query):
    """Search shufersal order history."""
    matches = []
    parsed = load_json(os.path.join(WORKSPACE, 'shufersal', 'data', 'parsed_orders.json'))
    if parsed:
        for item in parsed.get('item_summary', []):
            name = item.get('name', '')
            if fuzzy_match(query, name):
                matches.append({
                    'source': 'history',
                    'name': name,
                    'num_orders': item.get('num_orders', 0),
                    'total_qty': item.get('total_qty', 0),
                })
    return matches

def route(query):
    leket_matches = search_leket(query)
    shufersal_matches = search_shufersal(query)
    
    in_leket = len(leket_matches) > 0
    in_shufersal = len(shufersal_matches) > 0
    
    # Prefer leket for fresh produce (catalog hit = strong signal)
    catalog_hits = [m for m in leket_matches if m.get('source') == 'catalog' and m.get('available')]
    
    if catalog_hits and not in_shufersal:
        store = 'leket'
        reason = f'נמצא בקטלוג לקט ({catalog_hits[0]["name"]})'
    elif catalog_hits and in_shufersal:
        store = 'leket'
        reason = f'נמצא בקטלוג לקט — מוצר טרי, עדיפות ללקט'
    elif in_leket and not in_shufersal:
        store = 'leket'
        reason = f'נמצא בהיסטוריית לקט ({leket_matches[0]["name"]})'
    elif in_shufersal and not in_leket:
        store = 'shufersal'
        reason = f'נמצא בהיסטוריית שופרסל ({shufersal_matches[0]["name"]})'
    elif in_leket and in_shufersal:
        store = 'both'
        reason = f'נמצא בשניהם — לקט: {leket_matches[0]["name"]} | שופרסל: {shufersal_matches[0]["name"]}'
    else:
        store = 'ask'
        reason = 'לא נמצא בקטלוג לקט או בהיסטוריית שופרסל'
    
    return {
        'query': query,
        'store': store,
        'reason': reason,
        'leket': leket_matches[:3],
        'shufersal': shufersal_matches[:3],
    }

if __name__ == '__main__':
    query = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else ''
    if not query:
        print('Usage: python3 shopping_router.py <product name>')
        sys.exit(1)
    result = route(query)
    print(json.dumps(result, ensure_ascii=False, indent=2))
