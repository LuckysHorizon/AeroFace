-- Create function to get nearby lounges using PostGIS
CREATE OR REPLACE FUNCTION get_nearby_lounges(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  airport_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  rating FLOAT,
  google_place_id TEXT,
  website TEXT,
  phone_number TEXT,
  opening_hours JSONB,
  amenities JSONB,
  image_url TEXT,
  distance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.airport_name,
    l.latitude,
    l.longitude,
    l.address,
    l.rating,
    l.google_place_id,
    l.website,
    l.phone_number,
    l.opening_hours,
    l.amenities,
    l.image_url,
    ROUND(
      CAST(
        ST_Distance(
          l.location,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) / 1000 AS NUMERIC
      ),
      2
    ) AS distance
  FROM lounges l
  WHERE ST_DWithin(
    l.location,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_km * 1000
  )
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql STABLE;
