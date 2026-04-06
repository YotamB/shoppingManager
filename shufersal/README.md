# 🛒 Shufersal Auto-Order

Automatically analyzes your Shufersal shopping history and predicts your next order.

## How it works

1. **Scrape** — logs into Shufersal, fetches all order history
2. **Analyze** — finds your staples, calculates buying frequency, predicts what you need
3. **UI** — lets you review and edit the predicted cart
4. **Order** — opens a browser, adds items to your cart, you do the final checkout

## Quick Start

```bash
cd shufersal

# Open the UI (recommended)
npm run ui
# → opens http://localhost:3737 in your browser

# Or use CLI:
npm run dry-run    # preview predicted cart
npm run order      # add items to Shufersal cart
```

## Refresh data

```bash
npm run refresh    # re-scrape Shufersal + re-analyze
```

Or click the 🔄 button in the UI.

## Files

| File | Purpose |
|------|---------|
| `config.json` | Credentials + settings |
| `scrape.js` | Login + fetch order history |
| `analyze.js` | Build predictions from history |
| `order.js` | Add cart items via browser automation |
| `ui.js` | Local web UI for cart review |
| `data/orders.json` | Raw scraped order data |
| `data/analysis.json` | Computed product stats |
| `data/predicted-cart.json` | Predicted next order |

## Settings (config.json)

| Setting | Default | Description |
|---------|---------|-------------|
| `minFrequencyPct` | 23 | Only predict products bought in ≥23% of orders |
| `minNeedScore` | 0.7 | Only include if days-since-last ≥ 70% of avg cycle |
| `excludeCategories` | delivery fees | Products to always exclude |
| `headless` | true | Run browser invisibly (set false to watch it work) |

## Notes

- Fresh produce (fruit/veg) is included in predictions — quantities are in kg
- You always do the final checkout — the script never auto-pays
- Run `npm run refresh` every few months to keep predictions accurate
