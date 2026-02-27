// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Indian Airport Lounge Database ──────────────────────────────
const INDIAN_LOUNGES: Record<string, any[]> = {
  DEL: [
    {
      id: "del-1",
      name: "ITC Hotels Green Lounge",
      airport_name: "Indira Gandhi International Airport (DEL)",
      airport_code: "DEL",
      terminal: "Terminal 3",
      latitude: 28.5562,
      longitude: 77.1,
      address: "T3 Departures, IGI Airport, New Delhi 110037",
      rating: 4.6,
      google_place_id: "del-itc-green",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Spa", "Quiet Zone", "Bar"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Credit Card Access, Walk-in",
    },
    {
      id: "del-2",
      name: "Plaza Premium Lounge",
      airport_name: "Indira Gandhi International Airport (DEL)",
      airport_code: "DEL",
      terminal: "Terminal 3",
      latitude: 28.5565,
      longitude: 77.1003,
      address: "T3 International Departures, IGI Airport, New Delhi 110037",
      rating: 4.5,
      google_place_id: "del-plaza-premium",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Nap Area", "Bar"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, DragonPass, Walk-in ₹2500",
    },
    {
      id: "del-3",
      name: "TFS Privé Lounge",
      airport_name: "Indira Gandhi International Airport (DEL)",
      airport_code: "DEL",
      terminal: "Terminal 3",
      latitude: 28.5568,
      longitude: 77.0998,
      address: "T3 Domestic Departures, IGI Airport, New Delhi 110037",
      rating: 4.3,
      google_place_id: "del-tfs-prive",
      amenities: ["WiFi", "Food & Beverage", "TV Lounge", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Credit Card Access, Walk-in ₹1500",
    },
    {
      id: "del-4",
      name: "Encalm Privé Lounge",
      airport_name: "Indira Gandhi International Airport (DEL)",
      airport_code: "DEL",
      terminal: "Terminal 3",
      latitude: 28.5570,
      longitude: 77.1005,
      address: "T3 International Departures, IGI Airport, New Delhi 110037",
      rating: 4.7,
      google_place_id: "del-encalm-prive",
      amenities: ["WiFi", "Shower", "Fine Dining", "Live Kitchen", "Spa", "Bar", "Quiet Zone"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Invite-only, Walk-in ₹4000",
    },
  ],
  BOM: [
    {
      id: "bom-1",
      name: "GVK Lounge",
      airport_name: "Chhatrapati Shivaji Maharaj International Airport (BOM)",
      airport_code: "BOM",
      terminal: "Terminal 2",
      latitude: 19.0896,
      longitude: 72.8656,
      address: "T2 International Departures, Mumbai Airport, Mumbai 400099",
      rating: 4.5,
      google_place_id: "bom-gvk",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Spa", "Bar"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹3000",
    },
    {
      id: "bom-2",
      name: "Pranaam GVK Lounge",
      airport_name: "Chhatrapati Shivaji Maharaj International Airport (BOM)",
      airport_code: "BOM",
      terminal: "Terminal 2",
      latitude: 19.0898,
      longitude: 72.8660,
      address: "T2 Domestic Departures, Mumbai Airport, Mumbai 400099",
      rating: 4.4,
      google_place_id: "bom-pranaam",
      amenities: ["WiFi", "Food & Beverage", "Nap Pods", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Credit Card Access, Walk-in ₹2000",
    },
    {
      id: "bom-3",
      name: "Adani Lounge",
      airport_name: "Chhatrapati Shivaji Maharaj International Airport (BOM)",
      airport_code: "BOM",
      terminal: "Terminal 1",
      latitude: 19.0964,
      longitude: 72.8527,
      address: "T1 Domestic Departures, Mumbai Airport, Mumbai 400099",
      rating: 4.2,
      google_place_id: "bom-adani",
      amenities: ["WiFi", "Food & Beverage", "TV Lounge"],
      opening_hours: "5:00 AM - 12:00 AM",
      access_info: "Walk-in ₹1200",
    },
  ],
  BLR: [
    {
      id: "blr-1",
      name: "Above Ground Level Lounge",
      airport_name: "Kempegowda International Airport (BLR)",
      airport_code: "BLR",
      terminal: "Terminal 1",
      latitude: 13.1986,
      longitude: 77.7066,
      address: "T1 Domestic Departures, BLR Airport, Bengaluru 560300",
      rating: 4.4,
      google_place_id: "blr-agl",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Bar", "Quiet Zone"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹2000",
    },
    {
      id: "blr-2",
      name: "Plaza Premium Lounge",
      airport_name: "Kempegowda International Airport (BLR)",
      airport_code: "BLR",
      terminal: "Terminal 2",
      latitude: 13.1990,
      longitude: 77.7070,
      address: "T2 International Departures, BLR Airport, Bengaluru 560300",
      rating: 4.5,
      google_place_id: "blr-plaza",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Nap Area", "Bar"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, DragonPass, Walk-in ₹2500",
    },
    {
      id: "blr-3",
      name: "TFS Lounge",
      airport_name: "Kempegowda International Airport (BLR)",
      airport_code: "BLR",
      terminal: "Terminal 1",
      latitude: 13.1988,
      longitude: 77.7068,
      address: "T1 Departures, BLR Airport, Bengaluru 560300",
      rating: 4.1,
      google_place_id: "blr-tfs",
      amenities: ["WiFi", "Food & Beverage", "Charging Points"],
      opening_hours: "5:00 AM - 11:00 PM",
      access_info: "Credit Card Access, Walk-in ₹1500",
    },
  ],
  HYD: [
    {
      id: "hyd-1",
      name: "Plaza Premium Lounge",
      airport_name: "Rajiv Gandhi International Airport (HYD)",
      airport_code: "HYD",
      terminal: "Main Terminal",
      latitude: 17.2403,
      longitude: 78.4294,
      address: "Domestic Departures, RGIA Airport, Shamshabad, Hyderabad 500108",
      rating: 4.5,
      google_place_id: "hyd-plaza",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Bar", "Nap Area"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, DragonPass, Walk-in ₹2500",
    },
    {
      id: "hyd-2",
      name: "Above Ground Level (AGL) Lounge",
      airport_name: "Rajiv Gandhi International Airport (HYD)",
      airport_code: "HYD",
      terminal: "Main Terminal",
      latitude: 17.2405,
      longitude: 78.4296,
      address: "International Departures, RGIA Airport, Shamshabad, Hyderabad 500108",
      rating: 4.3,
      google_place_id: "hyd-agl",
      amenities: ["WiFi", "Food & Beverage", "Quiet Zone", "Charging Points", "Bar"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹2000",
    },
    {
      id: "hyd-3",
      name: "Encalm Lounge",
      airport_name: "Rajiv Gandhi International Airport (HYD)",
      airport_code: "HYD",
      terminal: "Main Terminal",
      latitude: 17.2401,
      longitude: 78.4290,
      address: "Domestic Departures, RGIA Airport, Shamshabad, Hyderabad 500108",
      rating: 4.4,
      google_place_id: "hyd-encalm",
      amenities: ["WiFi", "Food & Beverage", "Live Kitchen", "Spa", "Shower"],
      opening_hours: "24 Hours",
      access_info: "Credit Card Access, Walk-in ₹2200",
    },
  ],
  MAA: [
    {
      id: "maa-1",
      name: "Travel Club Lounge",
      airport_name: "Chennai International Airport (MAA)",
      airport_code: "MAA",
      terminal: "Terminal 1",
      latitude: 12.9941,
      longitude: 80.1709,
      address: "T1 Domestic Departures, Chennai Airport, Chennai 600027",
      rating: 4.2,
      google_place_id: "maa-travel-club",
      amenities: ["WiFi", "Food & Beverage", "Charging Points", "TV Lounge"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Credit Card Access, Walk-in ₹1800",
    },
    {
      id: "maa-2",
      name: "TFS Privé Lounge",
      airport_name: "Chennai International Airport (MAA)",
      airport_code: "MAA",
      terminal: "Terminal 4",
      latitude: 12.9945,
      longitude: 80.1712,
      address: "T4 International Departures, Chennai Airport, Chennai 600027",
      rating: 4.3,
      google_place_id: "maa-tfs",
      amenities: ["WiFi", "Shower", "Food & Beverage", "Bar", "Quiet Zone"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹2500",
    },
  ],
  CCU: [
    {
      id: "ccu-1",
      name: "TFS Lounge",
      airport_name: "Netaji Subhas Chandra Bose International Airport (CCU)",
      airport_code: "CCU",
      terminal: "Terminal 2",
      latitude: 22.6546,
      longitude: 88.4467,
      address: "T2 Domestic Departures, Kolkata Airport, Kolkata 700052",
      rating: 4.1,
      google_place_id: "ccu-tfs",
      amenities: ["WiFi", "Food & Beverage", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹1500",
    },
    {
      id: "ccu-2",
      name: "Plaza Premium Lounge",
      airport_name: "Netaji Subhas Chandra Bose International Airport (CCU)",
      airport_code: "CCU",
      terminal: "Terminal 2",
      latitude: 22.6548,
      longitude: 88.4470,
      address: "T2 International Departures, Kolkata Airport, Kolkata 700052",
      rating: 4.3,
      google_place_id: "ccu-plaza",
      amenities: ["WiFi", "Food & Beverage", "Shower", "Nap Area"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, DragonPass, Walk-in ₹2000",
    },
  ],
  GOI: [
    {
      id: "goi-1",
      name: "Above Ground Level Lounge",
      airport_name: "Goa International Airport (GOI)",
      airport_code: "GOI",
      terminal: "Main Terminal",
      latitude: 15.3808,
      longitude: 73.8314,
      address: "Departures, Dabolim Airport, Goa 403801",
      rating: 4.0,
      google_place_id: "goi-agl",
      amenities: ["WiFi", "Food & Beverage", "Bar"],
      opening_hours: "6:00 AM - 10:00 PM",
      access_info: "Priority Pass, Walk-in ₹1800",
    },
  ],
  COK: [
    {
      id: "cok-1",
      name: "TFS Lounge",
      airport_name: "Cochin International Airport (COK)",
      airport_code: "COK",
      terminal: "Terminal 3",
      latitude: 10.152,
      longitude: 76.4019,
      address: "T3 International Departures, Cochin Airport, Kochi 683111",
      rating: 4.2,
      google_place_id: "cok-tfs",
      amenities: ["WiFi", "Food & Beverage", "Shower", "Quiet Zone"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹2000",
    },
  ],
  AMD: [
    {
      id: "amd-1",
      name: "Encalm Lounge",
      airport_name: "Sardar Vallabhbhai Patel International Airport (AMD)",
      airport_code: "AMD",
      terminal: "Terminal 2",
      latitude: 23.0772,
      longitude: 72.6347,
      address: "T2 Domestic Departures, Ahmedabad Airport, Ahmedabad 380003",
      rating: 4.3,
      google_place_id: "amd-encalm",
      amenities: ["WiFi", "Food & Beverage", "Quiet Zone", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Credit Card Access, Walk-in ₹1500",
    },
  ],
  PNQ: [
    {
      id: "pnq-1",
      name: "Above Ground Level Lounge",
      airport_name: "Pune Airport (PNQ)",
      airport_code: "PNQ",
      terminal: "Main Terminal",
      latitude: 18.5822,
      longitude: 73.9197,
      address: "Departures, Pune Airport, Pune 411032",
      rating: 4.0,
      google_place_id: "pnq-agl",
      amenities: ["WiFi", "Food & Beverage", "Charging Points"],
      opening_hours: "6:00 AM - 10:00 PM",
      access_info: "Priority Pass, Walk-in ₹1500",
    },
  ],
  JAI: [
    {
      id: "jai-1",
      name: "TFS Lounge",
      airport_name: "Jaipur International Airport (JAI)",
      airport_code: "JAI",
      terminal: "Terminal 2",
      latitude: 26.8242,
      longitude: 75.8122,
      address: "T2 Departures, Jaipur Airport, Jaipur 302029",
      rating: 4.1,
      google_place_id: "jai-tfs",
      amenities: ["WiFi", "Food & Beverage", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹1500",
    },
  ],
  LKO: [
    {
      id: "lko-1",
      name: "Above Ground Level Lounge",
      airport_name: "Chaudhary Charan Singh International Airport (LKO)",
      airport_code: "LKO",
      terminal: "Main Terminal",
      latitude: 26.7606,
      longitude: 80.8893,
      address: "Departures, Lucknow Airport, Lucknow 226009",
      rating: 4.0,
      google_place_id: "lko-agl",
      amenities: ["WiFi", "Food & Beverage", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹1500",
    },
  ],
  GAU: [
    {
      id: "gau-1",
      name: "Encalm Lounge",
      airport_name: "Lokpriya Gopinath Bordoloi International Airport (GAU)",
      airport_code: "GAU",
      terminal: "Main Terminal",
      latitude: 26.1061,
      longitude: 91.5859,
      address: "Departures, Guwahati Airport, Guwahati 781015",
      rating: 4.0,
      google_place_id: "gau-encalm",
      amenities: ["WiFi", "Food & Beverage"],
      opening_hours: "6:00 AM - 10:00 PM",
      access_info: "Priority Pass, Walk-in ₹1500",
    },
  ],
  IXC: [
    {
      id: "ixc-1",
      name: "Above Ground Level Lounge",
      airport_name: "Chandigarh International Airport (IXC)",
      airport_code: "IXC",
      terminal: "Main Terminal",
      latitude: 30.6735,
      longitude: 76.7885,
      address: "Departures, Chandigarh Airport, Chandigarh 160003",
      rating: 3.9,
      google_place_id: "ixc-agl",
      amenities: ["WiFi", "Food & Beverage"],
      opening_hours: "6:00 AM - 10:00 PM",
      access_info: "Priority Pass, Walk-in ₹1500",
    },
  ],
  VNS: [
    {
      id: "vns-1",
      name: "Encalm Lounge",
      airport_name: "Lal Bahadur Shastri International Airport (VNS)",
      airport_code: "VNS",
      terminal: "Main Terminal",
      latitude: 25.4515,
      longitude: 82.8593,
      address: "Departures, Varanasi Airport, Varanasi 221002",
      rating: 4.0,
      google_place_id: "vns-encalm",
      amenities: ["WiFi", "Food & Beverage"],
      opening_hours: "6:00 AM - 10:00 PM",
      access_info: "Priority Pass, Walk-in ₹1200",
    },
  ],
  TRV: [
    {
      id: "trv-1",
      name: "TFS Lounge",
      airport_name: "Trivandrum International Airport (TRV)",
      airport_code: "TRV",
      terminal: "Main Terminal",
      latitude: 8.4821,
      longitude: 76.9199,
      address: "International Departures, Trivandrum Airport, Thiruvananthapuram 695008",
      rating: 4.1,
      google_place_id: "trv-tfs",
      amenities: ["WiFi", "Food & Beverage", "Charging Points"],
      opening_hours: "24 Hours",
      access_info: "Priority Pass, Walk-in ₹1800",
    },
  ],
};

// ── Airport Coordinates for distance calculation ────────────────
const AIRPORTS: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  DEL: { lat: 28.5562, lng: 77.1000, city: "New Delhi", state: "Delhi" },
  BOM: { lat: 19.0896, lng: 72.8656, city: "Mumbai", state: "Maharashtra" },
  BLR: { lat: 13.1986, lng: 77.7066, city: "Bengaluru", state: "Karnataka" },
  HYD: { lat: 17.2403, lng: 78.4294, city: "Hyderabad", state: "Telangana" },
  MAA: { lat: 12.9941, lng: 80.1709, city: "Chennai", state: "Tamil Nadu" },
  CCU: { lat: 22.6546, lng: 88.4467, city: "Kolkata", state: "West Bengal" },
  GOI: { lat: 15.3808, lng: 73.8314, city: "Goa", state: "Goa" },
  COK: { lat: 10.1520, lng: 76.4019, city: "Kochi", state: "Kerala" },
  AMD: { lat: 23.0772, lng: 72.6347, city: "Ahmedabad", state: "Gujarat" },
  PNQ: { lat: 18.5822, lng: 73.9197, city: "Pune", state: "Maharashtra" },
  JAI: { lat: 26.8242, lng: 75.8122, city: "Jaipur", state: "Rajasthan" },
  LKO: { lat: 26.7606, lng: 80.8893, city: "Lucknow", state: "Uttar Pradesh" },
  GAU: { lat: 26.1061, lng: 91.5859, city: "Guwahati", state: "Assam" },
  IXC: { lat: 30.6735, lng: 76.7885, city: "Chandigarh", state: "Chandigarh" },
  VNS: { lat: 25.4515, lng: 82.8593, city: "Varanasi", state: "Uttar Pradesh" },
  TRV: { lat: 8.4821, lng: 76.9199, city: "Thiruvananthapuram", state: "Kerala" },
};

// ── Haversine distance (km) ─────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Find nearest airport to user location ───────────────────────
function findNearestAirport(lat: number, lng: number): { code: string; distance: number } {
  let nearest = { code: "HYD", distance: Infinity };
  for (const [code, airport] of Object.entries(AIRPORTS)) {
    const d = haversine(lat, lng, airport.lat, airport.lng);
    if (d < nearest.distance) {
      nearest = { code, distance: d };
    }
  }
  return nearest;
}

console.log("✅ fetch-lounges function initialized");

serve(async (req: Request) => {
  console.log(`📨 Received ${req.method} request`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let airportCode: string | null = null;

    try {
      const body = await req.json();
      latitude = body?.latitude ?? null;
      longitude = body?.longitude ?? null;
      airportCode = body?.airport_code ?? null;
      console.log(`📍 Location: ${latitude}, ${longitude} | Airport: ${airportCode}`);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which airport to show lounges for
    let selectedAirport = airportCode?.toUpperCase() || null;
    let nearestDistance = 0;

    if (!selectedAirport && latitude && longitude) {
      const nearest = findNearestAirport(latitude, longitude);
      selectedAirport = nearest.code;
      nearestDistance = Math.round(nearest.distance);
      console.log(`🏢 Nearest airport: ${selectedAirport} (${nearestDistance} km away)`);
    }

    if (!selectedAirport) {
      selectedAirport = "HYD"; // Default
    }

    // Get lounges for selected airport
    const lounges = (INDIAN_LOUNGES[selectedAirport] || []).map((lounge: any) => {
      const dist =
        latitude && longitude
          ? parseFloat(haversine(latitude, longitude, lounge.latitude, lounge.longitude).toFixed(1))
          : 0;
      return { ...lounge, distance: dist };
    });

    // Build airports list for dropdown
    const airportsList = Object.entries(AIRPORTS).map(([code, info]) => ({
      code,
      city: info.city,
      state: info.state,
      label: `${info.city} (${code})`,
      loungeCount: (INDIAN_LOUNGES[code] || []).length,
      distance:
        latitude && longitude
          ? parseFloat(haversine(latitude, longitude, info.lat, info.lng).toFixed(0))
          : null,
    }));

    // Sort airports by distance if user location is available
    if (latitude && longitude) {
      airportsList.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
    }

    const response = {
      success: true,
      selected_airport: selectedAirport,
      airport_city: AIRPORTS[selectedAirport]?.city || selectedAirport,
      airport_state: AIRPORTS[selectedAirport]?.state || "",
      nearest_distance_km: nearestDistance,
      lounges,
      airports: airportsList,
      source: "aeroface_db",
    };

    console.log(`✅ Returning ${lounges.length} lounges for ${selectedAirport}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error", success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
