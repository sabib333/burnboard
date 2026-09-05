# Social Network Health — Measurement Definitions

The social layer's observability. All figures are computed from real rows by
`lib/socialHealth.js` and surfaced at `/admin/social` (via `GET /api/admin/social`). The API
is admin-gated (fail-closed, MP26) and requires the **service-role key**: `follows`,
`notifications`, `user_blocks`, and `user_mutes` are owner-scoped under RLS, so the anon key
would silently under-count — unavailable is reported rather than a false zero.

## Metrics and what they actually measure

### Follow graph (`follows`)
- `totalEdges`, `edges24h/7d/30d` — rows created in the window. **Unfollows are deleted rows
  (no tombstone), so only creation is measurable — never net growth.**
- `accountsGainingFollowers7d`, `accountsStartingToFollow7d` — distinct accounts on either end
  of edges created in the window (bounded read of up to 5,000 recent edges).

### New-user social activation (`user_profiles` + `follows`/`community_members`/`social_posts`/`comments`)
Computed on the **newest 250 accounts created within the last 90 days** (a bounded cohort,
labeled as a sample):
- `followingSharePct` — the "first connection rate": share of the cohort with ≥ 1 follow edge.
- `firstFollowWithin7dSharePct` — of those who follow, the share whose first follow happened
  within 7 days of signup (time-to-first-connection).
- `reciprocalFollowSharePct` — of those who follow, the share with ≥ 1 follow-back. Exact
  presence check bounded to each account's first 200 outgoing follows.
- `communityJoinSharePct` / `firstCommunityJoinWithin7dSharePct` — share joining a community
  and how fast.
- `createdContentSharePct`, `commentedSharePct` — share that posted / commented.

### Community ecosystem (`communities`, `community_members`, `social_posts`)
- Active communities (public/private), new communities 7d/30d.
- `joins7d/30d`, `distinctJoiners7d` — memberships created with `membership_status = 'active'`.
- `communitiesWithPosts7d` — distinct communities that received a `visible` post in the window.
- Owner / moderator counts.
- **Leaves are deleted rows and member churn has no timestamp — only joins are measurable.**

### Conversations (`comments`, `reactions`, `social_posts`)
- `posts7d`, `comments7d/24h`, `distinctCommenters7d`, `distinctThreads7d`, `replies7d`,
  `replySharePct` (depth proxy), `lightReactions7d`, `reactionsPerComment`.
- Semantics: comments/replies are the **meaningful-interaction** signal; reactions are one-tap
  **light** interaction. Depth and ratios are proxies, not satisfaction measures.

### Return-loop engine (`notifications`)
- `delivered7d/24h`, `unreadTotal`, `topTypes7d`.
- Notifications are deduped, preference-gated, and safety-gated (muted/blocked actors cannot
  deliver), so volume reflects genuinely allowed return-loop events.

### Boundaries (`user_blocks`, `user_mutes`)
- `blocks7d/30d`, `mutes7d/30d`, `distinctBlockers7d`. Boundaries are healthy user control —
  the alert is on the *ratio*, never on the users who block.

## Computed alerts (directional, not enforcement)

| Alert | Condition | Why |
| --- | --- | --- |
| `graph_empty` / `graph_idle` | accounts exist but 0 edges; or edges but 0 in 7d | connection loop stalled |
| `activation_low` | cohort `followingSharePct` < 25% | most new accounts never reach a first connection |
| `reciprocity_low` | cohort follow-back share < 15% | one-way network dynamics |
| `boundary_ratio_high` | blocks ≥ 5 and (blocks + mutes) / new follows > 0.5 | possible harassment amplification — investigate, never punish blockers |
| `conversation_idle` | posts 7d > 0, comments 7d = 0 | content without conversation |
| `community_stagnant` | communities exist, 0 joins 7d | discovery/invite loops idle |
| `return_loop_silent` | network active but 0 notifications 7d | return-loop engine not wired to events |

Thresholds are starting points for review, stored in `app/api/admin/social/route.js`, and
tuned with operating experience — they never auto-restrict anyone.

## Known limitations (honest)

1. No unfollow / community-leave tombstones → no churn or net-growth measurement.
2. Activation & reciprocity are bounded samples.
3. No per-user satisfaction instrument (surveys, explicit feedback loops) — conversation depth
   and boundaries are the best available health signals.
4. No group/DM/friendship edges exist yet, so density is follow- and community-based only.

## Maturity thresholds (next steps, staged)

- **Product**: measure churn by adding tombstones (`unfollows`/`community_leave_log`) when the
  follow/leave flows next change; add a first-connection moment in onboarding that records a
  server-verified activation event.
- **Scale**: move graph aggregates into the daily cron snapshot when row counts pass the
  bounded-read caps (5k), matching the growth-snapshot pattern.
- **Experimentation**: the alert set above is the guardrail set for any social-flow experiment
  (follow prompts, community suggestions, notification timing).
