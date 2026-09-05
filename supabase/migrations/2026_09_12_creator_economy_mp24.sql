-- ═══════════════════════════════════════════════════════════
-- BURNBOARD Creator Economy — Payout Requests (Master Prompt 24)
--
-- NON-DESTRUCTIVE: only adds an RPC function. No table, column, or row is
-- modified, renamed, or deleted.
--
-- What this adds:
--   request_creator_payout(p_user, p_min_minor, p_origin) — the creator-
--   facing payout REQUEST step of the payout lifecycle:
--
--     EARNINGS → PENDING → AVAILABLE → PAYOUT REQUEST → PROCESSING → COMPLETED
--
--   Guardrails (all server-side, SECURITY DEFINER):
--     * Owner-scoped: auth.uid() must equal p_user (a creator can only ever
--       request THEIR OWN payout).
--     * Minimum threshold: available earnings must be >= the configured
--       minimum (the app layer passes the policy value; SQL enforces it).
--     * One open payout at a time: no concurrent pending/held/processing
--       payout may already exist (prevents double-request races).
--     * Ledger-consistent: available is moved to pending on the derived
--       balance row (CHECK constraints keep both non-negative), and a payout
--       row is appended with a unique request token — never an UPDATE of
--       history.
--     * Audited: every request appends a financial audit line.
--
--   IMPORTANT: requesting a payout does NOT move real money. The payout stays
--   'pending' until an admin/provider-confirmed payout driver processes it
--   (none is wired yet — the sandbox provider never touches production). This
--   function makes the REQUEST honest and visible; it promises nothing about
--   instant payouts.
-- ═══════════════════════════════════════════════════════════

create or replace function request_creator_payout(
  p_user uuid,
  p_min_minor int default 1000,
  p_origin text default 'prod'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance monetization_creator_balances%ROWTYPE;
  v_open int;
  v_payout_id uuid;
  v_token text;
begin
  -- Owner-scoped: creators may only request their own payouts.
  if p_user is null or auth.uid() is null or auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select * into v_balance
    from monetization_creator_balances
    where user_id = p_user;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_balance');
  end if;

  -- Minimum threshold (policy value supplied by the app layer).
  if v_balance.available_minor < p_min_minor then
    return jsonb_build_object(
      'ok', false,
      'reason', 'below_minimum',
      'minimum_minor', p_min_minor,
      'available_minor', v_balance.available_minor
    );
  end if;

  -- One open payout at a time.
  select count(*) into v_open
    from monetization_payouts
    where user_id = p_user
      and status in ('pending', 'held', 'processing');
  if v_open > 0 then
    return jsonb_build_object('ok', false, 'reason', 'open_payout');
  end if;

  v_token := 'po_' || replace(gen_random_uuid()::text, '-', '');

  -- Append the payout request (ledger row; nothing moves yet).
  insert into monetization_payouts
    (user_id, amount_minor, currency, status, request_token, origin)
  values
    (p_user, v_balance.available_minor, v_balance.currency, 'pending', v_token, p_origin)
  returning id into v_payout_id;

  -- Move available → pending on the derived balance (non-negative CHECKs
  -- guarantee consistency; this is the only sanctioned transition).
  update monetization_creator_balances
    set available_minor = available_minor - v_balance.available_minor,
        pending_minor = pending_minor + v_balance.available_minor,
        updated_at = now()
    where user_id = p_user;

  perform record_monetization_audit(
    'payout_requested',
    jsonb_build_object(
      'payout_id', v_payout_id,
      'amount_minor', v_balance.available_minor,
      'currency', v_balance.currency
    ),
    auth.uid(),
    p_user
  );

  return jsonb_build_object(
    'ok', true,
    'payout_id', v_payout_id,
    'amount_minor', v_balance.available_minor,
    'currency', v_balance.currency
  );
end;
$$;

revoke all on function request_creator_payout(uuid, int, text) from public;
grant execute on function request_creator_payout(uuid, int, text) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- DONE — Creator payout request added (additive only)
-- ═══════════════════════════════════════════════════════════