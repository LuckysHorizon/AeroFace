-- ═══════════════════════════════════════════════════════════════════
-- 009: Fix get_lounge_stats to count unique users, not subscription rows
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_lounge_stats(p_lounge_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE((
      SELECT SUM(amount) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id AND status = 'completed'
    ), 0),
    'today_revenue', COALESCE((
      SELECT SUM(amount) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id
        AND status = 'completed'
        AND transaction_date >= CURRENT_DATE
    ), 0),
    'month_revenue', COALESCE((
      SELECT SUM(amount) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id
        AND status = 'completed'
        AND transaction_date >= date_trunc('month', CURRENT_DATE)
    ), 0),
    'total_members', (
      SELECT COUNT(DISTINCT user_id) FROM lounge_memberships
      WHERE lounge_id = p_lounge_id
    ),
    'active_members', (
      SELECT COUNT(DISTINCT user_id) FROM lounge_memberships
      WHERE lounge_id = p_lounge_id AND status = 'active'
    ),
    'pending_members', (
      SELECT COUNT(DISTINCT user_id) FROM lounge_memberships
      WHERE lounge_id = p_lounge_id AND status = 'pending'
    ),
    'total_transactions', (
      SELECT COUNT(*) FROM lounge_transactions
      WHERE lounge_id = p_lounge_id AND status = 'completed'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
