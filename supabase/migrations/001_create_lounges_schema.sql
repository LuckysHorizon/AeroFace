-- Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create lounges table
CREATE TABLE IF NOT EXISTS lounges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  airport_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  rating FLOAT,
  google_place_id TEXT UNIQUE,
  website TEXT,
  phone_number TEXT,
  opening_hours JSONB,
  amenities JSONB DEFAULT '[]'::jsonb,
  image_url TEXT,
  location GEOGRAPHY(Point, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lounge_cache table for Google API caching
CREATE TABLE IF NOT EXISTS lounge_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_key TEXT UNIQUE NOT NULL,
  response JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_saved_lounges table for bookmarks
CREATE TABLE IF NOT EXISTS user_saved_lounges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lounge_id UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lounge_id)
);

-- Create geospatial indexes for performance
CREATE INDEX idx_lounges_location ON lounges USING GIST(location);
CREATE INDEX idx_lounge_cache_grid_key ON lounge_cache(grid_key);
CREATE INDEX idx_lounge_cache_expires_at ON lounge_cache(expires_at);
CREATE INDEX idx_user_saved_lounges_user_id ON user_saved_lounges(user_id);

-- Create RLS (Row Level Security) policies
ALTER TABLE lounges ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_lounges ENABLE ROW LEVEL SECURITY;

-- Allow public read access to lounges
CREATE POLICY "Allow public read access to lounges"
ON lounges FOR SELECT
TO public
USING (true);

-- Allow users to read their own saved lounges
CREATE POLICY "Users can read their own saved lounges"
ON user_saved_lounges FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to create/delete their own saved lounges
CREATE POLICY "Users can create their own saved lounges"
ON user_saved_lounges FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved lounges"
ON user_saved_lounges FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Cache policy - allow service role to manage
CREATE POLICY "Allow cache management"
ON lounge_cache FOR ALL
TO authenticated
USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER tr_lounges_update_timestamp
BEFORE UPDATE ON lounges
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to generate location from lat/lng
CREATE OR REPLACE FUNCTION set_location_from_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for location update
CREATE TRIGGER tr_lounges_set_location
BEFORE INSERT OR UPDATE ON lounges
FOR EACH ROW
EXECUTE FUNCTION set_location_from_coordinates();
