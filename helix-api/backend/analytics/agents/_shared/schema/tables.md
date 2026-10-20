# Database catalog

The analysis target is the database configured in **Settings** (engine, host, database, credentials). Its schema is introspected at run time and injected into every agent prompt as **Live catalog** — that is the authoritative object and column list for any SELECT.

Never invent tables, views, or columns. Prefer the live catalog over anything written here.

## Query speed

- Filter the driving / fact table first with sargable predicates on keys the user named.
- Bound every SELECT with `TOP`, `FETCH`, or `LIMIT` unless config allows otherwise.
- Join lookup tables only for display columns; resolve names to ids on small lookups.
- Default to a recent time window when the user did not ask for all history.
- Rankings: filter, aggregate, window rank, keep the top row per group, outer bound.

## Catalog

Document your own objects below as sections named exactly `schema.table`. A documented section is kept in the prompt only while that object exists in the connected database, so this file stays valid across engines and databases.

## Conventions (Sales, Warehouse, Purchase, HumanResource)

- **Fiscal year:** `Sal` on sales documents is the Jalali fiscal year (e.g. `1405`). Pair it with a sargable Gregorian range on the matching `Tarikh*` column (`>= start AND < next_start`), not `YEAR(col)`.
- **Keys:** `cc*` columns are surrogate keys (e.g. `ccKala`, `ccMarkazPakhsh`, `ccMoshtary`). Join facts on `cc*`, not on name columns.
- **Names:** `Name*` columns are display labels (Persian/Arabic script; centers may use Arabic ي/ك, e.g. `N'تهران يک'`).
- **Status / type codes:** Small integers or short codes in `Vazeiat*`, `Noe*`, `Code*` columns — use `sample_rows` or lookup tables before filtering.
- **Amounts:** Invoice and line amounts are typically in Rial (`Mablagh*`).

## Global.MarkazPakhsh

- **Kind:** table
- **Description:** Distribution center (markaz pakhsh) master: surrogate key and display name used to label sales and warehouse facts.

| Column | Meaning |
| ccMarkazPakhsh | Primary key of the distribution center |
| NameMarkazPakhsh | Center name shown in reports (Persian) |
| CodeMarkazPakhsh | Short business code when present |
| Vazeiat | Active/inactive or operational status code |

## Warehouse.Kala

- **Kind:** table
- **Description:** Product (kala) master: codes and names joined from sales lines, purchase, and inventory.

| Column | Meaning |
| ccKala | Product surrogate key (join key for line facts) |
| NameKala | Product display name |
| CodeKala | Product business code / generic code when present |
| ccBrand | Brand lookup key when present |
| Vazeiat | Product lifecycle status code |

## Purchase.TaminKonandeh

- **Kind:** table
- **Description:** Supplier (tamin konandeh) master for purchase and supplier-share reporting.

| Column | Meaning |
| ccTaminKonandeh | Supplier surrogate key |
| NameTaminKonandeh | Supplier name |
| CodeTaminKonandeh | Supplier business code |
| Vazeiat | Active/inactive status |

## HumanResource.Foroshandeh

- **Kind:** table
- **Description:** Salesperson (foroshandeh) master linked to routes, centers, and sales targets.

| Column | Meaning |
| ccForoshandeh | Salesperson surrogate key |
| NameForoshandeh | Salesperson display name |
| ccMarkazPakhsh | Home distribution center when assigned |
| Vazeiat | Employment/active status code |
