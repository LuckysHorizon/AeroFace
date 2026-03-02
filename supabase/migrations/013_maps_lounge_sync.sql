-- ═══════════════════════════════════════════════════════════════════
--  013 — Sync Maps Lounges RPC
--  Automatically creates a Lounge record and default Pricing Plans
--  when a user clicks a lounge from Google Maps API.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_maps_lounge(
  p_google_place_id TEXT,
  p_name TEXT,
  p_airport_code TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_address TEXT,
  p_image_url TEXT
)
RETURNS UUID AS $$
DECLARE
  v_lounge_id UUID;
  v_plan_exists BOOLEAN;
BEGIN
  -- 1. Try to find the lounge by Google Place ID
  SELECT id INTO v_lounge_id FROM lounges WHERE google_place_id = p_google_place_id LIMIT 1;

  -- 2. If it doesn't exist, create it
  IF v_lounge_id IS NULL THEN
    INSERT INTO lounges (
      google_place_id,
      name,
      airport_name,
      airport_code,
      latitude,
      longitude,
      address,
      image_url,
      is_active
    ) VALUES (
      p_google_place_id,
      p_name,
      COALESCE(p_airport_code, 'Unknown Airport'),
      p_airport_code,
      p_latitude,
      p_longitude,
      p_address,
      p_image_url,
      true
    ) RETURNING id INTO v_lounge_id;
  END IF;

  -- 3. Ensure default plans exist for this lounge
  -- Check if any plans exist for this lounge
  SELECT EXISTS (SELECT 1 FROM lounge_plans WHERE lounge_id = v_lounge_id) INTO v_plan_exists;

  IF NOT v_plan_exists THEN
    -- Insert exactly 3 default plans (Hourly, Standard, Premium)
    
    -- Plan 1: 1 Hour Base Access
    INSERT INTO lounge_plans (
      lounge_id,
      name,
      description,
      price,
      currency,
      duration_days,
      features,
      is_active
    ) VALUES (
      v_lounge_id,
      '1 Hour Access - ' || p_name,
      'Basic hourly access to ' || p_name,
      500,
      'INR',
      1, -- Treats duration_days=1 as the baseline for hourly mapping on frontend
      '["Buffet Access", "Wi-Fi", "Charging Stations"]'::jsonb,
      true
    );

    -- Plan 2: Standard 30 Day Subscription
    INSERT INTO lounge_plans (
      lounge_id,
      name,
      description,
      price,
      currency,
      duration_days,
      features,
      is_active
    ) VALUES (
      v_lounge_id,
      'Standard Subscription - ' || p_name,
      '30-day access to ' || p_name,
      2500,
      'INR',
      30,
      '["Buffet Access", "Wi-Fi", "Charging Stations", "Priority Boarding Assist"]'::jsonb,
      true
    );

    -- Plan 3: Premium 30 Day Subscription
    INSERT INTO lounge_plans (
      lounge_id,
      name,
      description,
      price,
      currency,
      duration_days,
      features,
      is_active
    ) VALUES (
      v_lounge_id,
      'Premium Subscription - ' || p_name,
      '30-day premium access to ' || p_name || ' including Spa, Shower & Bar',
      5000,
      'INR',
      30,
      '["All Standard Features", "Premium Bar", "Shower Access", "Spa Access", "Quiet Zones"]'::jsonb,
      true
    );
  END IF;

  RETURN v_lounge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
