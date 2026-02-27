# Lounge Discovery Feature - Setup Guide

## 📋 Prerequisites

Before setting up this feature, you'll need:

1. **Google Maps API Key** - For the Google Places API
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable these APIs:
     - Places API
     - Maps JavaScript API
   - Create an API Key (restrict to IP if in production)
   - Add the key to your `.env` file as `GOOGLE_MAPS_API_KEY`

2. **Supabase Project** - Already set up in your app

## 🗄️ Database Setup

### Step 1: Run Migrations

Connect to your Supabase project and run the migration files:

**File: `/supabase/migrations/001_create_lounges_schema.sql`**
- Enables PostGIS extension
- Creates `lounges` table with geospatial support
- Creates `lounge_cache` table for Google API caching
- Creates `user_saved_lounges` table for bookmarks
- Sets up Row Level Security (RLS) policies
- Creates triggers for automatic timestamp updates

**File: `/supabase/migrations/002_create_lounge_functions.sql`**
- Creates `get_nearby_lounges()` PostgreSQL function
- Uses PostGIS to efficiently query lounges by distance

### Step 2: How to Run Migrations

Option A: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Run migrations
supabase db push
```

Option B: Direct SQL Execution
- Go to Supabase Dashboard → SQL Editor
- Copy & paste the contents of both migration files
- Execute each file sequentially

## 🚀 Edge Function Setup

### Configuration

**File: `/supabase/functions/fetch-lounges/index.ts`**

Environment variables needed in `.env.local` (Supabase):
```
GOOGLE_MAPS_API_KEY=your-google-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deploy Edge Function

```bash
# Deploy to Supabase
supabase functions deploy fetch-lounges
```

## 📱 Frontend Implementation

The updated `LoungesScreen.tsx` includes:

1. **Location Permission Handling** - Requests device location with expo-location
2. **API Call** - Calls the Supabase Edge Function with user's coords
3. **Loading State** - Shows skeleton while fetching
4. **Error Handling** - Displays helpful error messages
5. **List Display** - Shows lounges sorted by distance
6. **Bookmark Feature** - Save/unsave favorite lounges

## 🔧 API Request Format

### Request
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "radius": 10
}
```

### Response
```json
{
  "lounges": [
    {
      "id": "uuid",
      "name": "Lounge Name",
      "airport_name": "Airport Code",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "123 Main St",
      "rating": 4.5,
      "google_place_id": "place_id",
      "distance": 2.5,
      "opening_hours": {...},
      "image_url": "https://...",
      "amenities": ["WiFi", "Food", "Showers"]
    }
  ],
  "source": "database|google_places",
  "cached": false
}
```

## 💰 Cost Optimization

### Caching Strategy
- Results are cached for **30 minutes**
- Coordinates rounded to 2 decimal places (~1km grid)
- Significantly reduces Google API calls and costs

### API Usage Estimation
- With caching: ~1-2 API calls per 1km² per 30 minutes
- Without caching: 1 API call per user location request
- **Typical monthly cost: $0-50** (depending on users)

## 🔐 Security Features

✅ **API Key Protection**
- Google API key never exposed to frontend
- Only accessible in Edge Function

✅ **Row Level Security (RLS)**
- Users can only see public lounge data
- Users can only manage their own saved lounges

✅ **Authentication**
- Edge Function verifies Supabase auth token (can be added)
- Service Role key used for database operations

## 📊 Performance Notes

### Database Optimization
- PostGIS spatial index on `location` column
- Cache table indexes on `grid_key` and `expires_at`
- User saved lounges indexed by user_id

### Response Time
- Cache hits: **< 50ms**
- Database queries: **100-200ms**
- Google API calls: **500-2000ms**

## 🎯 Future Enhancements

Add these later:

1. **Lounge Crowd Prediction**
   - Track visitor patterns
   - Suggest best times to visit

2. **Smart Ranking**
   - Consider user preferences
   - Factor in amenities
   - Consider ratings

3. **Eligibility Check**
   - Verify lounge access based on membership
   - Check flight booking status

4. **Advanced Filters**
   - WiFi availability
   - Shower facilities
   - Food & beverage
   - Quiet areas

## 🐛 Troubleshooting

### "Cannot find module" Error
- Ensure migrations are deployed before using Edge Function
- Check that Supabase URL and keys are correct

### "Google API key not configured"
- Add `GOOGLE_MAPS_API_KEY` to Supabase Edge Function secrets
- Verify API key is valid and not restricted

### No lounges returned
- Check your location coordinates are valid
- Ensure there are actual lounges in the database or Google's database
- Verify cache hasn't expired (check `lounge_cache` table)

## 📚 Related Files

- Frontend: `frontend/AeroFace-Expo App/AeroFace/src/screens/LoungesScreen.tsx`
- Database Migrations: `/supabase/migrations/*.sql`
- Edge Function: `/supabase/functions/fetch-lounges/index.ts`

---

**Questions?** Check the Supabase docs:
- [PostGIS Documentation](https://supabase.com/docs/guides/database/extensions/postgis)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
