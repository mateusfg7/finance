# Introduction

Awesome—let’s lock down a crisp MVP scope for a Fastify + Bun finance API and the domains it’ll live in. I’ll keep it DDD-friendly and ready to scale later (budgets, rules, imports), but intentionally tiny for v0.

# Scope & principles

* Personal finance tracker (single user to start; multi-user later).
* Single-entry ledger now; easy migration path to double-entry later.
* Money as a value object (integer cents + currency code).
* Transactions are append-only; edits are new versions.

# MVP Functional Requirements (FR)

**FR-01 Create account**

* As a user, I can create accounts (e.g., “Wallet”, “Checking”, “Credit Card”) with a name, type, currency, and optional opening balance/date.
* Invariants: one currency per account; archived accounts can’t accept new transactions.

**FR-02 List & view accounts**

* List my accounts with computed balances and last activity date.
* View a single account with its running balance.

**FR-03 Record transaction**

* Add a transaction to an account with: occurredAt, amount (positive for inflow, negative for outflow), optional payee, memo, category, tags, cleared flag.
* Invariants: transaction currency = account currency; amount ≠ 0.

**FR-04 List & filter transactions**

* Query by account, date range, category, payee, cleared, min/max amount, text search (memo/payee/tags).
* Pagination & stable ordering (occurredAt desc, then id).

**FR-05 Categories (flat or tree)**

* CRUD categories (parentId optional).
* Assign category on create or update of a transaction.
* Invariants: no cycles; unique name per parent.

**FR-06 Running balances**

* For any account, return balance at “now” and at a given date (sum of all amounts ≤ date).
* Must be correct under concurrent writes.

**FR-07 Edit/void transaction**

* “Edit” creates a new version; previous version is superseded (or soft-deleted with link).
* Optional “void” flag preserves audit trail with zeroed financial impact.

**FR-08 Health & metadata**

* /health, version, build info.

*(Stretch after MVP:)* imports (CSV/OFX), split transactions, budgets, rules/automation, reconciliation, multi-user/auth, double-entry, recurring transactions.

# Non-Functional Requirements (NFR)

* **API**: REST over JSON, idempotent POST with client token optional (X-Idempotency-Key).
* **Validation**: Zod (or equivalent) schemas at the edge.
* **Money**: store as integers (cents) + ISO 4217 code; format in clients.
* **Time**: store UTC timestamps; accept ISO-8601 with timezone.
* **Perf**: list endpoints paginated; filters indexed.
* **Observability**: request logging, basic metrics (req/s, latency, 5xx), structured logs.
* **Testing**: unit (domain), contract (routes), integration (repo).
* **Security**: for MVP single-user, static API key in header; upgrade to JWT later.

# Domains & Bounded Contexts

## 1) **Ledger** (Core Domain, MVP)

**Aggregates / Entities**

* **Account**: id, name, type (checking, cash, credit, savings, other), currency, openedAt, archivedAt, openingBalanceCents.
* **Transaction**: id, accountId, occurredAt, amountCents, payee, memo, categoryId?, tags\[], cleared, versionOf? (for edits), voidedAt?.
* **Category**: id, name, parentId?, isArchived.

**Value Objects**

* **Money**: { amountCents: number; currency: string }
* **DateRange**, **Tag**

**Invariants**

* Account.currency = Transaction.currency
* Category tree has no cycles
* Transaction edits preserve original via versionOf

**Domain Events (optional for now)**

* AccountCreated, TransactionRecorded, TransactionVoided, CategoryCreated

## 2) **Catalog/Classification** (MVP)

* Owns category tree rules and naming constraints.

## 3) **Identity & Access** (Later)

* Users, API keys/JWT, roles. (Stubbed in MVP as single user.)

## 4) **Budgeting** (Later)

* Envelopes/limits per category per period, burn rate, alerts.

## 5) **Import/Automation** (Later)

* CSV/OFX importers, rules (“if payee \~= ‘UBER’ then category = Transport”).

# Data Model (MVP, relational-friendly)

* `accounts(id, name, type, currency, opened_at, archived_at, opening_balance_cents)`
* `categories(id, name, parent_id, archived_at)`
* `transactions(id, account_id, occurred_at, amount_cents, payee, memo, category_id, tags_json, cleared, version_of, voided_at, created_at)`

  * indexes: (account\_id, occurred\_at desc), (category\_id), (cleared), full-text/payee+memo (or trigram)

*(Skip splits in MVP; add `transaction_splits` later if needed.)*

# API surface (v1, minimal)

**Accounts**

* `POST /v1/accounts`
* `GET  /v1/accounts` → list + balances
* `GET  /v1/accounts/:id`
* `GET  /v1/accounts/:id/balance?at=YYYY-MM-DD`

**Categories**

* `POST /v1/categories`
* `GET  /v1/categories`
* `PATCH /v1/categories/:id` (rename, archive, reparent)

**Transactions**

* `POST /v1/accounts/:id/transactions`
* `GET  /v1/accounts/:id/transactions?from=&to=&categoryId=&q=&cleared=&min=&max=&page=&limit=`
* `PATCH /v1/transactions/:id` (creates new version under the hood or flags void)
* `POST /v1/transactions/:id/void`

**Health**

* `GET /health`

### Example payloads

**POST /v1/accounts**

```json
{ "name": "Checking", "type": "checking", "currency": "BRL", "openedAt": "2025-09-01", "openingBalanceCents": 250000 }
```

**POST /v1/accounts/\:id/transactions**

```json
{
  "occurredAt": "2025-09-17T12:30:00-03:00",
  "amountCents": -4599,
  "payee": "Bakery Dona Ana",
  "memo": "Lunch",
  "categoryId": "cat-food",
  "tags": ["workday", "downtown"],
  "cleared": true
}
```

# Acceptance criteria (MVP)

* Creating an account returns 201 with resource id; subsequent GET shows zero or opening balance.
* Recording transactions updates computed balances correctly, including back-dated entries.
* Listing transactions is stable and filterable; pagination cursors/links are correct.
* Category CRUD enforces no cycles; archived categories can’t be assigned.
* Editing a transaction preserves history (old → versionOf = new\.id or vice-versa) and balances reflect new version only.
* Health returns `{ status: "ok", version }`.

# Folder layout (suggested)

```
apps/api
  ├─ src/
  │   ├─ app.ts (Fastify instance + plugins)
  │   ├─ routes/ (http handlers only)
  │   ├─ modules/
  │   │   ├─ ledger/
  │   │   │   ├─ domain/ (entities, VOs, services, events)
  │   │   │   ├─ app/ (use-cases: CreateAccount, RecordTransaction, etc.)
  │   │   │   ├─ infra/ (repos, mappers)
  │   │   │   └─ http/ (schemas + route bindings)
  │   │   └─ catalog/
  │   ├─ shared/ (errors, Result/Either, Money utils, time)
  │   └─ config/
  └─ test/
```

# Phase plan

* **v0.1 (MVP here)**: Accounts, Categories, Transactions, Balances, Health, single user.
* **v0.2**: CSV import, split transactions, reconciliation flags.
* **v0.3**: Budgets (monthly per category), budget reports.
* **v0.4**: Rules & auto-categorization, scheduled recurring tx.
* **v0.5**: Auth (multi-user), double-entry option, webhooks.

