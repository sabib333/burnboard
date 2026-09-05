# Platform Roadmap

## Where we are

The governed foundation is live: app registry with lifecycle states,
hashed credentials, scoped user grants with instant revocation, a versioned
public API (`/api/platform/v1`), signed webhooks with retries, audit
logging, kill switches, a Developer Portal, and a Connected Apps surface.

## Platform flywheel (what we are building toward)

```
MORE USERS → MORE CREATOR NEEDS → MORE DEVELOPER OPPORTUNITY
    → MORE APPLICATIONS → MORE PRODUCT CAPABILITIES → MORE USER VALUE
    → MORE RETENTION → MORE USERS
```

Each stage below is gated on ecosystem evidence — never built on
assumption.

## Stage 2: richer read APIs + creator tools

- `creator.analytics.read` scope: a creator's OWN aggregate dashboard data.
- More v1 domains only when a real developer need exists.
- Creator-tool SDK hooks (content planning, scheduling drafts server-side).

## Stage 3: mini-app sandbox

Design only until liquidity exists. Principles fixed now:
- Mini apps are served in a sandboxed iframe + a permission manifest.
- They receive a scoped grant exactly like server apps (no ambient access).
- They never execute in a trusted platform context.
- Discovery only surfaces `approved` apps; paid placement is disclosed.

## Stage 4: integration marketplace

- Listing shows developer identity, permissions, privacy info, support —
  never hides who operates an app.
- Installation is explicit consent (the existing grant flow).
- Ratings require real usage; fake/coordinated reviews are an abuse signal.
- Paid placement in discovery is always labeled.

## API monetization (design posture)

- A generous free tier first; paid tiers only after the ecosystem creates
  value (never charging developers before value exists).
- Usage tiers = quota enforcement on the existing rate-limit machinery.
- Developer billing reuses the MP19 ledger; it is fully separated from
  creator earnings records.

## SDK strategy

JS/TypeScript first (mirrors the product). A TS SDK wraps the v1 API + the
signature-verification helper. Python only when real demand appears. No SDK
is shipped that the team cannot reliably support.

## Non-goals (explicitly deferred)

- Unrestricted database access (never).
- Anonymous unlimited API access (never).
- Apps that send messages as users, control payouts, or bypass moderation
  (never — scope catalog has no such scope and never will).
- Fully autonomous third-party agents with production authority.
- Permanent unlimited tokens (all grants expire; all can be revoked).