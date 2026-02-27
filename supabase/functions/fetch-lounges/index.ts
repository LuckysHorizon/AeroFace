// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ═══════════════════════════════════════════════════════════════════
//  AeroFace — fetch-lounges Edge Function (v3)
//
//  Secure Architecture:
//    - Google API key NEVER leaves the server
//    - Photo proxy: GET ?photo_ref=XYZ streams images through backend
//    - POST {lat,lng,airport_code} → lounges + airports
//    - Places API primary → curated mock data fallback
// ═══════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_FUNC_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/fetch-lounges";

// ═══════════════════════════════════════════════════════════════════
//  1. PHOTO PROXY — stream Google Place Photos without leaking key
// ═══════════════════════════════════════════════════════════════════

async function handlePhotoProxy(photoRef: string, maxWidth: string): Promise<Response> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return new Response("Photo service unavailable", { status: 503, headers: corsHeaders });
  }

  const url = "https://maps.googleapis.com/maps/api/place/photo"
    + "?maxwidth=" + (maxWidth || "800")
    + "&photoreference=" + photoRef
    + "&key=" + apiKey;

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.error("Photo proxy error: " + res.status);
      return new Response("Photo not found", { status: 404, headers: corsHeaders });
    }

    // Stream the image back with proper content type and cache headers
    return new Response(res.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (err) {
    console.error("Photo proxy fetch failed:", err);
    return new Response("Photo fetch failed", { status: 500, headers: corsHeaders });
  }
}

// ═══════════════════════════════════════════════════════════════════
//  2. GOOGLE PLACES API — Nearby Search with secure photo URLs
// ═══════════════════════════════════════════════════════════════════

async function fetchFromGooglePlaces(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  apiKey: string,
  airportCode: string
): Promise<{ lounges: any[]; status: string } | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", latitude + "," + longitude);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("keyword", "airport lounge");
    url.searchParams.set("type", "establishment");
    url.searchParams.set("key", apiKey);

    console.log("[Places] Nearby Search at " + latitude + "," + longitude + " r=" + radiusMeters);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("[Places] HTTP " + res.status);
      return null;
    }

    const json = await res.json();
    console.log("[Places] status=" + json.status + " results=" + (json.results?.length ?? 0));

    if (json.status === "REQUEST_DENIED") {
      console.error("[Places] REQUEST_DENIED — " + (json.error_message || "Check API key & billing"));
      return { lounges: [], status: "REQUEST_DENIED" };
    }
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.error("[Places] " + json.status + " — " + (json.error_message || ""));
      return null;
    }
    if (!json.results || json.results.length === 0) {
      return { lounges: [], status: json.status };
    }

    const airportInfo = AIRPORTS[airportCode];

    const lounges = json.results.map((place: any, idx: number) => {
      // Build secure photo URL through our proxy
      const photoRef = place.photos?.[0]?.photo_reference || null;
      const photoUrl = photoRef
        ? SUPABASE_FUNC_URL + "?photo_ref=" + encodeURIComponent(photoRef) + "&w=800"
        : null;

      return {
        id: place.place_id || ("gp-" + idx),
        name: place.name || "Airport Lounge",
        airport_name: airportInfo
          ? airportInfo.city + " Airport (" + airportCode + ")"
          : extractAirportName(place),
        airport_code: airportCode,
        terminal: inferTerminal(place.name || "", place.vicinity || ""),
        latitude: place.geometry?.location?.lat ?? latitude,
        longitude: place.geometry?.location?.lng ?? longitude,
        address: place.vicinity || place.formatted_address || "",
        rating: place.rating ?? 0,
        user_ratings_total: place.user_ratings_total ?? 0,
        google_place_id: place.place_id || "",
        photo_url: photoUrl,
        photo_ref: photoRef,
        opening_hours: place.opening_hours?.open_now != null
          ? (place.opening_hours.open_now ? "Open Now" : "Currently Closed")
          : "Hours Unknown",
        is_open: place.opening_hours?.open_now ?? null,
        amenities: inferAmenities(place),
        access_info: inferAccessInfo(place),
        price_level: place.price_level ?? null,
        business_status: place.business_status || "OPERATIONAL",
        distance: haversine(latitude, longitude,
          place.geometry?.location?.lat ?? latitude,
          place.geometry?.location?.lng ?? longitude),
      };
    });

    return { lounges, status: "OK" };
  } catch (err) {
    console.error("[Places] Error:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  3. PLACE DETAILS — enrich top results with extra data
// ═══════════════════════════════════════════════════════════════════

async function enrichWithDetails(
  lounges: any[],
  apiKey: string,
  maxEnrich: number
): Promise<any[]> {
  const toEnrich = lounges.slice(0, maxEnrich);
  const rest = lounges.slice(maxEnrich);

  const enriched = await Promise.all(
    toEnrich.map(async (lounge: any) => {
      if (!lounge.google_place_id) return lounge;
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        url.searchParams.set("place_id", lounge.google_place_id);
        url.searchParams.set("fields", "formatted_phone_number,website,url,reviews,opening_hours,editorial_summary");
        url.searchParams.set("key", apiKey);

        const res = await fetch(url.toString());
        if (!res.ok) return lounge;

        const json = await res.json();
        if (json.status !== "OK" || !json.result) return lounge;

        const d = json.result;
        return {
          ...lounge,
          phone: d.formatted_phone_number || null,
          website: d.website || null,
          maps_url: d.url || null,
          description: d.editorial_summary?.overview || null,
          opening_hours_detail: d.opening_hours?.weekday_text || null,
          review_count: d.reviews?.length || lounge.user_ratings_total,
          top_review: d.reviews?.[0]?.text || null,
        };
      } catch (_) {
        return lounge;
      }
    })
  );

  return [...enriched, ...rest];
}

// ═══════════════════════════════════════════════════════════════════
//  4. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

function extractAirportName(place: any): string {
  const text = ((place.name || "") + " " + (place.vicinity || "")).toLowerCase();
  const map: [RegExp, string][] = [
    [/indira gandhi|igi|delhi airport/i, "Indira Gandhi Intl Airport"],
    [/chhatrapati|csia|mumbai airport/i, "CSIA Mumbai"],
    [/kempegowda|bengaluru airport|bangalore/i, "Kempegowda Intl Airport"],
    [/rajiv gandhi|rgia|shamshabad|hyderabad/i, "RGIA Hyderabad"],
    [/chennai airport|meenambakkam/i, "Chennai Intl Airport"],
    [/netaji|kolkata airport|dum dum/i, "NSCBI Kolkata"],
    [/dabolim|goa airport|manohar/i, "Goa Airport"],
    [/cochin|kochi airport/i, "Cochin Intl Airport"],
    [/ahmedabad|sardar vallabhbhai/i, "SVPI Ahmedabad"],
  ];
  for (const [re, name] of map) { if (re.test(text)) return name; }
  return place.vicinity || "Airport";
}

function inferTerminal(name: string, vicinity: string): string {
  const text = (name + " " + vicinity).toLowerCase();
  const termMatch = text.match(/terminal\s*(\d+|[a-z])/i);
  if (termMatch) return "Terminal " + termMatch[1].toUpperCase();
  if (text.includes("t1") || text.includes("terminal 1")) return "Terminal 1";
  if (text.includes("t2") || text.includes("terminal 2")) return "Terminal 2";
  if (text.includes("t3") || text.includes("terminal 3")) return "Terminal 3";
  if (text.includes("domestic")) return "Domestic";
  if (text.includes("international")) return "International";
  return "";
}

function inferAmenities(place: any): string[] {
  const items: string[] = ["WiFi", "Food & Beverage"];
  const n = (place.name || "").toLowerCase();
  if (n.includes("premium") || n.includes("privé") || n.includes("prive") || n.includes("first")) {
    items.push("Shower", "Bar");
  }
  if (n.includes("spa")) items.push("Spa");
  if (n.includes("sleep") || n.includes("nap")) items.push("Nap Area");
  items.push("Charging Points");
  return [...new Set(items)];
}

function inferAccessInfo(place: any): string {
  const n = (place.name || "").toLowerCase();
  if (n.includes("premium") || n.includes("plaza")) return "Priority Pass, Walk-in Available";
  if (n.includes("privé") || n.includes("prive") || n.includes("encalm")) return "Priority Pass, Premium Access";
  return "Walk-in Available";
}

// ═══════════════════════════════════════════════════════════════════
//  5. INDIAN AIRPORTS & CURATED MOCK DATA (FALLBACK)
// ═══════════════════════════════════════════════════════════════════

const AIRPORTS: Record<string, { lat: number; lng: number; city: string; state: string; name: string }> = {
  DEL: { lat: 28.5562, lng: 77.1000, city: "New Delhi", state: "Delhi", name: "Indira Gandhi International Airport" },
  BOM: { lat: 19.0896, lng: 72.8656, city: "Mumbai", state: "Maharashtra", name: "Chhatrapati Shivaji Maharaj International Airport" },
  BLR: { lat: 13.1986, lng: 77.7066, city: "Bengaluru", state: "Karnataka", name: "Kempegowda International Airport" },
  HYD: { lat: 17.2403, lng: 78.4294, city: "Hyderabad", state: "Telangana", name: "Rajiv Gandhi International Airport" },
  MAA: { lat: 12.9941, lng: 80.1709, city: "Chennai", state: "Tamil Nadu", name: "Chennai International Airport" },
  CCU: { lat: 22.6546, lng: 88.4467, city: "Kolkata", state: "West Bengal", name: "Netaji Subhas Chandra Bose International Airport" },
  GOI: { lat: 15.3808, lng: 73.8314, city: "Goa", state: "Goa", name: "Goa International Airport" },
  COK: { lat: 10.1520, lng: 76.4019, city: "Kochi", state: "Kerala", name: "Cochin International Airport" },
  AMD: { lat: 23.0772, lng: 72.6347, city: "Ahmedabad", state: "Gujarat", name: "Sardar Vallabhbhai Patel International Airport" },
  PNQ: { lat: 18.5822, lng: 73.9197, city: "Pune", state: "Maharashtra", name: "Pune Airport" },
  JAI: { lat: 26.8242, lng: 75.8122, city: "Jaipur", state: "Rajasthan", name: "Jaipur International Airport" },
  LKO: { lat: 26.7606, lng: 80.8893, city: "Lucknow", state: "Uttar Pradesh", name: "Chaudhary Charan Singh International Airport" },
  GAU: { lat: 26.1061, lng: 91.5859, city: "Guwahati", state: "Assam", name: "Lokpriya Gopinath Bordoloi International Airport" },
  IXC: { lat: 30.6735, lng: 76.7885, city: "Chandigarh", state: "Chandigarh", name: "Chandigarh International Airport" },
  VNS: { lat: 25.4515, lng: 82.8593, city: "Varanasi", state: "Uttar Pradesh", name: "Lal Bahadur Shastri International Airport" },
  TRV: { lat: 8.4821, lng: 76.9199, city: "Thiruvananthapuram", state: "Kerala", name: "Trivandrum International Airport" },
};

const MOCK_LOUNGES: Record<string, any[]> = {
  DEL: [
    { id: "del-1", name: "ITC Hotels Green Lounge", airport_code: "DEL", terminal: "Terminal 3", latitude: 28.5562, longitude: 77.1, address: "T3 Departures, IGI Airport, New Delhi 110037", rating: 4.6, amenities: ["WiFi", "Shower", "Food & Beverage", "Spa", "Quiet Zone", "Bar"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Credit Card Access, Walk-in" },
    { id: "del-2", name: "Plaza Premium Lounge", airport_code: "DEL", terminal: "Terminal 3", latitude: 28.5565, longitude: 77.1003, address: "T3 International Departures, IGI Airport, New Delhi 110037", rating: 4.5, amenities: ["WiFi", "Shower", "Food & Beverage", "Nap Area", "Bar"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, DragonPass, Walk-in" },
    { id: "del-3", name: "Encalm Prive Lounge", airport_code: "DEL", terminal: "Terminal 3", latitude: 28.5570, longitude: 77.1005, address: "T3 International Departures, IGI Airport, New Delhi 110037", rating: 4.7, amenities: ["WiFi", "Shower", "Fine Dining", "Live Kitchen", "Spa", "Bar", "Quiet Zone"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Premium Access" },
  ],
  BOM: [
    { id: "bom-1", name: "GVK Lounge", airport_code: "BOM", terminal: "Terminal 2", latitude: 19.0896, longitude: 72.8656, address: "T2 International Departures, Mumbai Airport", rating: 4.5, amenities: ["WiFi", "Shower", "Food & Beverage", "Spa", "Bar"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" },
    { id: "bom-2", name: "Pranaam GVK Lounge", airport_code: "BOM", terminal: "Terminal 2", latitude: 19.0898, longitude: 72.866, address: "T2 Domestic Departures, Mumbai Airport", rating: 4.4, amenities: ["WiFi", "Food & Beverage", "Nap Pods", "Charging Points"], opening_hours: "24 Hours", is_open: true, access_info: "Credit Card Access, Walk-in Available" },
    { id: "bom-3", name: "Adani Lounge", airport_code: "BOM", terminal: "Terminal 1", latitude: 19.0964, longitude: 72.8527, address: "T1 Domestic Departures, Mumbai Airport", rating: 4.2, amenities: ["WiFi", "Food & Beverage", "TV Lounge"], opening_hours: "5:00 AM - 12:00 AM", is_open: true, access_info: "Walk-in Available" },
  ],
  BLR: [
    { id: "blr-1", name: "Above Ground Level Lounge", airport_code: "BLR", terminal: "Terminal 1", latitude: 13.1986, longitude: 77.7066, address: "T1 Domestic Departures, BLR Airport, Bengaluru", rating: 4.4, amenities: ["WiFi", "Shower", "Food & Beverage", "Bar", "Quiet Zone"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" },
    { id: "blr-2", name: "Plaza Premium Lounge", airport_code: "BLR", terminal: "Terminal 2", latitude: 13.199, longitude: 77.707, address: "T2 International Departures, BLR Airport, Bengaluru", rating: 4.5, amenities: ["WiFi", "Shower", "Food & Beverage", "Nap Area", "Bar"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, DragonPass, Walk-in Available" },
  ],
  HYD: [
    { id: "hyd-1", name: "Plaza Premium Lounge", airport_code: "HYD", terminal: "Main Terminal", latitude: 17.2403, longitude: 78.4294, address: "Domestic Departures, RGIA, Shamshabad", rating: 4.5, amenities: ["WiFi", "Shower", "Food & Beverage", "Bar", "Nap Area"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, DragonPass, Walk-in Available" },
    { id: "hyd-2", name: "Above Ground Level Lounge", airport_code: "HYD", terminal: "Main Terminal", latitude: 17.2405, longitude: 78.4296, address: "International Departures, RGIA, Shamshabad", rating: 4.3, amenities: ["WiFi", "Food & Beverage", "Quiet Zone", "Charging Points", "Bar"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" },
    { id: "hyd-3", name: "Encalm Lounge", airport_code: "HYD", terminal: "Main Terminal", latitude: 17.2401, longitude: 78.429, address: "Domestic Departures, RGIA, Shamshabad", rating: 4.4, amenities: ["WiFi", "Food & Beverage", "Live Kitchen", "Spa", "Shower"], opening_hours: "24 Hours", is_open: true, access_info: "Credit Card Access, Walk-in Available" },
  ],
  MAA: [
    { id: "maa-1", name: "Travel Club Lounge", airport_code: "MAA", terminal: "Terminal 1", latitude: 12.9941, longitude: 80.1709, address: "T1 Domestic Departures, Chennai Airport", rating: 4.2, amenities: ["WiFi", "Food & Beverage", "Charging Points", "TV Lounge"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Credit Card Access" },
    { id: "maa-2", name: "TFS Prive Lounge", airport_code: "MAA", terminal: "Terminal 4", latitude: 12.9945, longitude: 80.1712, address: "T4 International Departures, Chennai Airport", rating: 4.3, amenities: ["WiFi", "Shower", "Food & Beverage", "Bar", "Quiet Zone"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" },
  ],
  CCU: [
    { id: "ccu-1", name: "TFS Lounge", airport_code: "CCU", terminal: "Terminal 2", latitude: 22.6546, longitude: 88.4467, address: "T2 Domestic Departures, Kolkata Airport", rating: 4.1, amenities: ["WiFi", "Food & Beverage", "Charging Points"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" },
    { id: "ccu-2", name: "Plaza Premium Lounge", airport_code: "CCU", terminal: "Terminal 2", latitude: 22.6548, longitude: 88.447, address: "T2 International Departures, Kolkata Airport", rating: 4.3, amenities: ["WiFi", "Food & Beverage", "Shower", "Nap Area"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" },
  ],
  GOI: [{ id: "goi-1", name: "Above Ground Level Lounge", airport_code: "GOI", terminal: "Main Terminal", latitude: 15.3808, longitude: 73.8314, address: "Departures, Dabolim Airport, Goa", rating: 4.0, amenities: ["WiFi", "Food & Beverage", "Bar"], opening_hours: "6 AM - 10 PM", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  COK: [{ id: "cok-1", name: "TFS Lounge", airport_code: "COK", terminal: "Terminal 3", latitude: 10.152, longitude: 76.4019, address: "T3 International, Cochin Airport, Kochi", rating: 4.2, amenities: ["WiFi", "Food & Beverage", "Shower", "Quiet Zone"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  AMD: [{ id: "amd-1", name: "Encalm Lounge", airport_code: "AMD", terminal: "Terminal 2", latitude: 23.0772, longitude: 72.6347, address: "T2 Domestic, Ahmedabad Airport", rating: 4.3, amenities: ["WiFi", "Food & Beverage", "Quiet Zone", "Charging Points"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  PNQ: [{ id: "pnq-1", name: "Above Ground Level Lounge", airport_code: "PNQ", terminal: "Main Terminal", latitude: 18.5822, longitude: 73.9197, address: "Departures, Pune Airport", rating: 4.0, amenities: ["WiFi", "Food & Beverage", "Charging Points"], opening_hours: "6 AM - 10 PM", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  JAI: [{ id: "jai-1", name: "TFS Lounge", airport_code: "JAI", terminal: "Terminal 2", latitude: 26.8242, longitude: 75.8122, address: "T2 Departures, Jaipur Airport", rating: 4.1, amenities: ["WiFi", "Food & Beverage", "Charging Points"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  LKO: [{ id: "lko-1", name: "Above Ground Level Lounge", airport_code: "LKO", terminal: "Main Terminal", latitude: 26.7606, longitude: 80.8893, address: "Departures, Lucknow Airport", rating: 4.0, amenities: ["WiFi", "Food & Beverage", "Charging Points"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  GAU: [{ id: "gau-1", name: "Encalm Lounge", airport_code: "GAU", terminal: "Main Terminal", latitude: 26.1061, longitude: 91.5859, address: "Departures, Guwahati Airport", rating: 4.0, amenities: ["WiFi", "Food & Beverage"], opening_hours: "6 AM - 10 PM", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  IXC: [{ id: "ixc-1", name: "Above Ground Level Lounge", airport_code: "IXC", terminal: "Main Terminal", latitude: 30.6735, longitude: 76.7885, address: "Departures, Chandigarh Airport", rating: 3.9, amenities: ["WiFi", "Food & Beverage"], opening_hours: "6 AM - 10 PM", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  VNS: [{ id: "vns-1", name: "Encalm Lounge", airport_code: "VNS", terminal: "Main Terminal", latitude: 25.4515, longitude: 82.8593, address: "Departures, Varanasi Airport", rating: 4.0, amenities: ["WiFi", "Food & Beverage"], opening_hours: "6 AM - 10 PM", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
  TRV: [{ id: "trv-1", name: "TFS Lounge", airport_code: "TRV", terminal: "Main Terminal", latitude: 8.4821, longitude: 76.9199, address: "International Departures, Trivandrum Airport", rating: 4.1, amenities: ["WiFi", "Food & Beverage", "Charging Points"], opening_hours: "24 Hours", is_open: true, access_info: "Priority Pass, Walk-in Available" }],
};

function findNearestAirport(lat: number, lng: number): { code: string; distance: number } {
  let nearest = { code: "HYD", distance: Infinity };
  for (const [code, a] of Object.entries(AIRPORTS)) {
    const d = haversine(lat, lng, a.lat, a.lng);
    if (d < nearest.distance) nearest = { code, distance: d };
  }
  return nearest;
}

function getMockLounges(code: string, lat: number | null, lng: number | null): any[] {
  const info = AIRPORTS[code];
  return (MOCK_LOUNGES[code] || []).map((l: any) => ({
    ...l,
    airport_name: info ? info.name + " (" + code + ")" : code,
    photo_url: null,
    photo_ref: null,
    user_ratings_total: 0,
    google_place_id: l.id,
    distance: lat && lng ? haversine(lat, lng, l.latitude, l.longitude) : 0,
  }));
}

function buildAirportsList(lat: number | null, lng: number | null): any[] {
  const list = Object.entries(AIRPORTS).map(([code, info]) => ({
    code,
    city: info.city,
    state: info.state,
    name: info.name,
    label: info.city + " (" + code + ")",
    loungeCount: (MOCK_LOUNGES[code] || []).length,
    distance: lat && lng ? parseFloat(haversine(lat, lng, info.lat, info.lng).toFixed(0)) : null,
  }));
  if (lat && lng) list.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
  return list;
}

// ═══════════════════════════════════════════════════════════════════
//  6. MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════════════════════════

console.log("[fetch-lounges] v3 initialized");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── GET: Photo Proxy ──────────────────────────────────────────
  if (req.method === "GET") {
    const photoRef = url.searchParams.get("photo_ref");
    if (photoRef) {
      return handlePhotoProxy(photoRef, url.searchParams.get("w") || "800");
    }
    return json({ error: "GET requires ?photo_ref= parameter" }, 400);
  }

  // ── POST: Fetch Lounges ───────────────────────────────────────
  if (req.method !== "POST") {
    return json({ error: "Use POST for lounges, GET for photos" }, 405);
  }

  try {
    let latitude: number | null = null;
    let longitude: number | null = null;
    let airportCode: string | null = null;

    try {
      const body = await req.json();
      latitude = body?.latitude ?? null;
      longitude = body?.longitude ?? null;
      airportCode = body?.airport_code?.toUpperCase() ?? null;
    } catch (_) {
      return json({ error: "Invalid JSON body" }, 400);
    }

    console.log("[req] lat=" + latitude + " lng=" + longitude + " airport=" + airportCode);

    // Resolve airport
    let selectedAirport = airportCode;
    let nearestDistanceKm = 0;
    if (!selectedAirport && latitude && longitude) {
      const n = findNearestAirport(latitude, longitude);
      selectedAirport = n.code;
      nearestDistanceKm = Math.round(n.distance);
    }
    if (!selectedAirport) selectedAirport = "HYD";

    const info = AIRPORTS[selectedAirport];
    const searchLat = airportCode ? (info?.lat ?? latitude ?? 17.2403) : (latitude ?? info?.lat ?? 17.2403);
    const searchLng = airportCode ? (info?.lng ?? longitude ?? 78.4294) : (longitude ?? info?.lng ?? 78.4294);

    // Try Google Places API
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
    let lounges: any[] | null = null;
    let source = "mock_data";
    let placesStatus = "";

    if (apiKey) {
      console.log("[api] Key present, calling Nearby Search...");

      // Try 5km first
      const result5 = await fetchFromGooglePlaces(searchLat, searchLng, 5000, apiKey, selectedAirport);
      placesStatus = result5?.status || "ERROR";

      if (result5 && result5.lounges.length > 0) {
        lounges = result5.lounges;
        source = "google_places";
      } else if (result5 && result5.status !== "REQUEST_DENIED") {
        // Widen to 15km if no results (but not if denied)
        console.log("[api] No results at 5km, trying 15km...");
        const result15 = await fetchFromGooglePlaces(searchLat, searchLng, 15000, apiKey, selectedAirport);
        if (result15 && result15.lounges.length > 0) {
          lounges = result15.lounges;
          source = "google_places";
        }
      }

      // Enrich top 5 with Place Details
      if (lounges && source === "google_places") {
        lounges = await enrichWithDetails(lounges, apiKey, 5);
        lounges.sort((a: any, b: any) => a.distance - b.distance);
        console.log("[api] Enriched " + lounges.length + " lounges with details");
      }
    } else {
      console.log("[api] No GOOGLE_MAPS_API_KEY, using fallback");
      placesStatus = "NO_API_KEY";
    }

    // Fallback to mock
    if (!lounges || lounges.length === 0) {
      console.log("[fallback] Using mock data for " + selectedAirport);
      lounges = getMockLounges(selectedAirport, latitude, longitude);
      source = "mock_data";
    }

    const response = {
      success: true,
      selected_airport: selectedAirport,
      airport_city: info?.city || selectedAirport,
      airport_state: info?.state || "",
      airport_name: info?.name || "",
      nearest_distance_km: nearestDistanceKm,
      source,
      places_api_status: placesStatus,
      lounge_count: lounges.length,
      lounges,
      airports: buildAirportsList(latitude, longitude),
    };

    console.log("[done] " + lounges.length + " lounges (" + source + ") for " + selectedAirport);
    return json(response, 200);
  } catch (error: any) {
    console.error("[error]", error);
    return json({ error: error?.message || "Unknown error", success: false }, 500);
  }
});

function json(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
