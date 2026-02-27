// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ═══════════════════════════════════════════════════════════════════
//  AeroFace — scan-boarding-pass Edge Function
//
//  Endpoints:
//    POST  → Upload base64 image, OCR extract, store in DB
//    GET   → List user's boarding passes  (?action=list)
//    GET   → Get single boarding pass     (?id=UUID)
//    GET   → Get latest boarding pass     (?action=latest)
//
//  OCR: Google Cloud Vision API (TEXT_DETECTION)
// ═══════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Known Indian Airport Codes ─────────────────────────────────
const AIRPORT_LOOKUP: Record<string, string> = {
  DEL: "Indira Gandhi International Airport",
  BOM: "Chhatrapati Shivaji Maharaj International Airport",
  BLR: "Kempegowda International Airport",
  HYD: "Rajiv Gandhi International Airport",
  MAA: "Chennai International Airport",
  CCU: "Netaji Subhas Chandra Bose International Airport",
  COK: "Cochin International Airport",
  AMD: "Sardar Vallabhbhai Patel International Airport",
  PNQ: "Pune Airport",
  GOI: "Goa International Airport",
  JAI: "Jaipur International Airport",
  LKO: "Chaudhary Charan Singh International Airport",
  GAU: "Lokpriya Gopinath Bordoloi International Airport",
  IXC: "Chandigarh Airport",
  PAT: "Jay Prakash Narayan International Airport",
  TRV: "Trivandrum International Airport",
  VTZ: "Visakhapatnam Airport",
  IXB: "Bagdogra Airport",
  SXR: "Sheikh ul-Alam International Airport",
  IDR: "Devi Ahilyabai Holkar Airport",
  // International common ones
  DXB: "Dubai International Airport",
  SIN: "Singapore Changi Airport",
  LHR: "London Heathrow Airport",
  JFK: "John F. Kennedy International Airport",
  SFO: "San Francisco International Airport",
  BKK: "Suvarnabhumi Airport",
  KUL: "Kuala Lumpur International Airport",
  DOH: "Hamad International Airport",
  AUH: "Abu Dhabi International Airport",
};

// ── Known Airlines ─────────────────────────────────────────────
const AIRLINE_LOOKUP: Record<string, string> = {
  AI: "Air India",
  "6E": "IndiGo",
  SG: "SpiceJet",
  UK: "Vistara",
  G8: "Go First",
  QP: "Akasa Air",
  IX: "Air India Express",
  I5: "AirAsia India",
  EK: "Emirates",
  EY: "Etihad Airways",
  QR: "Qatar Airways",
  SQ: "Singapore Airlines",
  BA: "British Airways",
  LH: "Lufthansa",
  AA: "American Airlines",
  DL: "Delta Air Lines",
  UA: "United Airlines",
};

// ═══════════════════════════════════════════════════════════════════
//  Google Cloud Vision OCR
// ═══════════════════════════════════════════════════════════════════

async function callVisionOCR(base64Image: string): Promise<{ text: string; confidence: number }> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");  // Same Google Cloud project
  if (!apiKey) {
    throw new Error("Google API key not configured");
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  // Strip data URI prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const requestBody = {
    requests: [
      {
        image: { content: cleanBase64 },
        features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Vision API Error]", errText);
    throw new Error("Vision API error: " + res.status);
  }

  const data = await res.json();
  const annotation = data.responses?.[0]?.fullTextAnnotation;

  if (!annotation) {
    return { text: "", confidence: 0 };
  }

  // Calculate average confidence from pages
  let totalConfidence = 0;
  let blockCount = 0;
  for (const page of annotation.pages || []) {
    for (const block of page.blocks || []) {
      if (block.confidence) {
        totalConfidence += block.confidence;
        blockCount++;
      }
    }
  }

  return {
    text: annotation.text || "",
    confidence: blockCount > 0 ? totalConfidence / blockCount : 0.5,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  Boarding Pass Text Parser
// ═══════════════════════════════════════════════════════════════════

interface ParsedBoardingPass {
  passenger_name: string | null;
  flight_number: string | null;
  airline: string | null;
  departure_airport_code: string | null;
  departure_airport_name: string | null;
  arrival_airport_code: string | null;
  arrival_airport_name: string | null;
  departure_date: string | null;
  departure_time: string | null;
  boarding_time: string | null;
  gate: string | null;
  seat: string | null;
  booking_reference: string | null;
  travel_class: string | null;
  sequence_number: string | null;
}

function parseBoardingPassText(rawText: string): ParsedBoardingPass {
  const text = rawText.toUpperCase();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const result: ParsedBoardingPass = {
    passenger_name: null,
    flight_number: null,
    airline: null,
    departure_airport_code: null,
    departure_airport_name: null,
    arrival_airport_code: null,
    arrival_airport_name: null,
    departure_date: null,
    departure_time: null,
    boarding_time: null,
    gate: null,
    seat: null,
    booking_reference: null,
    travel_class: null,
    sequence_number: null,
  };

  // ── Flight Number (e.g., AI 839, 6E2341, UK 945) ─────────
  const flightMatch = text.match(/\b([A-Z0-9]{2})\s*(\d{3,4})\b/);
  if (flightMatch) {
    const code = flightMatch[1];
    const num = flightMatch[2];
    result.flight_number = code + " " + num;
    if (AIRLINE_LOOKUP[code]) {
      result.airline = AIRLINE_LOOKUP[code];
    }
  }

  // ── Airport Codes (3-letter IATA codes) ───────────────────
  // Look for FROM/TO pattern or two 3-letter codes together
  const allCodes: string[] = [];
  const codeMatches = text.matchAll(/\b([A-Z]{3})\b/g);
  for (const m of codeMatches) {
    const code = m[1];
    if (AIRPORT_LOOKUP[code]) {
      allCodes.push(code);
    }
  }

  // Also check for FROM → TO patterns
  const routeMatch = text.match(
    /(?:FROM|ORIGIN|DEPART(?:URE)?)\s*[:\-]?\s*([A-Z]{3})|([A-Z]{3})\s*(?:TO|→|->|–|—)\s*([A-Z]{3})/
  );
  if (routeMatch) {
    if (routeMatch[2] && routeMatch[3]) {
      result.departure_airport_code = routeMatch[2];
      result.arrival_airport_code = routeMatch[3];
    } else if (routeMatch[1]) {
      result.departure_airport_code = routeMatch[1];
    }
  }

  // Fallback: use first two recognized airport codes
  if (!result.departure_airport_code && allCodes.length >= 1) {
    result.departure_airport_code = allCodes[0];
  }
  if (!result.arrival_airport_code && allCodes.length >= 2) {
    result.arrival_airport_code = allCodes[1];
  }

  // Resolve airport names
  if (result.departure_airport_code && AIRPORT_LOOKUP[result.departure_airport_code]) {
    result.departure_airport_name = AIRPORT_LOOKUP[result.departure_airport_code];
  }
  if (result.arrival_airport_code && AIRPORT_LOOKUP[result.arrival_airport_code]) {
    result.arrival_airport_name = AIRPORT_LOOKUP[result.arrival_airport_code];
  }

  // ── Passenger Name ────────────────────────────────────────
  // Common patterns: "NAME: JOHN DOE", "PASSENGER: SMITH/JOHN", "MR JOHN DOE"
  const nameMatch = text.match(
    /(?:NAME|PASSENGER|PAX|TRAVELL?ER)\s*[:\-]?\s*([A-Z][A-Z\s\/\.]{2,30})/
  );
  if (nameMatch) {
    result.passenger_name = nameMatch[1].trim().replace(/\s+/g, " ");
  } else {
    // Try "LASTNAME/FIRSTNAME" format (common in boarding passes)
    const slashName = text.match(/\b([A-Z]{2,20})\/([A-Z]{2,20}(?:\s+[A-Z]+)?)\b/);
    if (slashName) {
      result.passenger_name = slashName[2] + " " + slashName[1];
    }
  }

  // ── Seat ──────────────────────────────────────────────────
  const seatMatch = text.match(/(?:SEAT|ST)\s*[:\-]?\s*(\d{1,2}[A-F])\b/);
  if (seatMatch) {
    result.seat = seatMatch[1];
  } else {
    // Fallback: look for standalone seat pattern near "SEAT" keyword
    const seatFallback = text.match(/\b(\d{1,2}[A-F])\b/);
    if (seatFallback) {
      result.seat = seatFallback[1];
    }
  }

  // ── Gate ──────────────────────────────────────────────────
  const gateMatch = text.match(/GATE\s*[:\-]?\s*([A-Z]?\d{1,3}[A-Z]?)/);
  if (gateMatch) {
    result.gate = gateMatch[1];
  }

  // ── Date ──────────────────────────────────────────────────
  // Multiple format support
  const datePatterns = [
    // DD MMM YYYY or DD MMM YY (e.g., 15 MAR 2026)
    /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*[',]?\s*(\d{2,4})/,
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/,
    // YYYY-MM-DD (ISO format)
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
  ];

  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };

  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      if (months[dateMatch[2]]) {
        // DD MMM YYYY format
        const day = dateMatch[1].padStart(2, "0");
        const month = months[dateMatch[2]];
        let year = dateMatch[3];
        if (year.length === 2) year = "20" + year;
        result.departure_date = `${year}-${month}-${day}`;
      } else if (dateMatch[1].length === 4) {
        // YYYY-MM-DD
        result.departure_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      } else {
        // DD/MM/YYYY
        let year = dateMatch[3];
        if (year.length === 2) year = "20" + year;
        result.departure_date = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
      }
      break;
    }
  }

  // ── Time (departure & boarding) ───────────────────────────
  const timeMatches = text.matchAll(
    /(?:(?:DEPART|DEP|ETD|BOARD(?:ING)?|BRD|TIME|SCHED)\s*[:\-]?\s*)?(\d{2})[:\.](\d{2})\b/g
  );
  const times: string[] = [];
  for (const m of timeMatches) {
    const h = parseInt(m[1]);
    if (h >= 0 && h <= 23) {
      times.push(m[1] + ":" + m[2]);
    }
  }
  if (times.length >= 2) {
    result.boarding_time = times[0];
    result.departure_time = times[1];
  } else if (times.length === 1) {
    result.departure_time = times[0];
  }

  // Also try labeled time patterns
  const boardTimeMatch = text.match(/BOARD(?:ING)?\s*(?:TIME)?\s*[:\-]?\s*(\d{2})[:\.](\d{2})/);
  if (boardTimeMatch) {
    result.boarding_time = boardTimeMatch[1] + ":" + boardTimeMatch[2];
  }
  const depTimeMatch = text.match(/(?:DEPART(?:URE)?|DEP|ETD)\s*(?:TIME)?\s*[:\-]?\s*(\d{2})[:\.](\d{2})/);
  if (depTimeMatch) {
    result.departure_time = depTimeMatch[1] + ":" + depTimeMatch[2];
  }

  // ── PNR / Booking Reference ───────────────────────────────
  const pnrMatch = text.match(
    /(?:PNR|BOOKING\s*REF(?:ERENCE)?|CONFIRM(?:ATION)?|RECORD\s*LOC(?:ATOR)?)\s*[:\-]?\s*([A-Z0-9]{5,8})/
  );
  if (pnrMatch) {
    result.booking_reference = pnrMatch[1];
  }

  // ── Travel Class ──────────────────────────────────────────
  const classMatch = text.match(
    /(?:CLASS|CL|CABIN)\s*[:\-]?\s*(ECONOMY|BUSINESS|FIRST|PREMIUM(?:\s*ECONOMY)?|ECON|BUS|[YJCF])\b/
  );
  if (classMatch) {
    const classMap: Record<string, string> = {
      Y: "Economy", ECON: "Economy", ECONOMY: "Economy",
      J: "Business", BUS: "Business", BUSINESS: "Business",
      C: "Business",
      F: "First", FIRST: "First",
    };
    const raw = classMatch[1];
    result.travel_class = classMap[raw] || raw;
  }

  // ── Sequence Number ───────────────────────────────────────
  const seqMatch = text.match(/(?:SEQ(?:UENCE)?|BOARDING\s*(?:NO|NUM|#))\s*[:\-]?\s*(\d{1,4})/);
  if (seqMatch) {
    result.sequence_number = seqMatch[1];
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
//  Supabase Client Helper
// ═══════════════════════════════════════════════════════════════════

function getSupabaseClient(authHeader?: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

function getUserIdFromJWT(authHeader: string): string | null {
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Handler: POST — Scan & Extract
// ═══════════════════════════════════════════════════════════════════

async function handleScan(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const userId = getUserIdFromJWT(authHeader);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: "Authentication required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const { image_base64 } = body;

  if (!image_base64) {
    return new Response(
      JSON.stringify({ success: false, error: "image_base64 is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Run OCR
    console.log("[scan] Running OCR for user:", userId);
    const { text: rawText, confidence } = await callVisionOCR(image_base64);

    if (!rawText) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not extract text from image. Please try a clearer photo.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[scan] OCR text length:", rawText.length, "confidence:", confidence.toFixed(2));

    // 2. Parse extracted text
    const parsed = parseBoardingPassText(rawText);
    console.log("[scan] Parsed:", JSON.stringify(parsed));

    // 3. Upload image to Supabase Storage
    const supabase = getSupabaseClient(authHeader);
    const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    const fileName = `${userId}/${Date.now()}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from("boarding-passes")
      .upload(fileName, imageBytes, { contentType: "image/jpeg", upsert: false });

    let imageUrl: string | null = null;
    if (uploadErr) {
      console.error("[scan] Storage upload error:", uploadErr.message);
      // Continue without image — don't fail the whole scan
    } else {
      const { data: urlData } = supabase.storage
        .from("boarding-passes")
        .getPublicUrl(fileName);
      imageUrl = urlData?.publicUrl || null;
    }

    // 4. Insert into DB
    const { data: insertedData, error: dbErr } = await supabase
      .from("boarding_passes")
      .insert({
        user_id: userId,
        ...parsed,
        image_url: imageUrl,
        raw_extracted_text: rawText,
        extraction_confidence: confidence,
        status: "processed",
      })
      .select()
      .single();

    if (dbErr) {
      console.error("[scan] DB insert error:", dbErr.message);
      // Return parsed data even if DB fails
      return new Response(
        JSON.stringify({
          success: true,
          boarding_pass: { ...parsed, extraction_confidence: confidence },
          warning: "Data extracted but could not save to database",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        boarding_pass: insertedData,
        message: "Boarding pass scanned successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[scan] Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "OCR processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Handler: GET — List / Fetch Boarding Passes
// ═══════════════════════════════════════════════════════════════════

async function handleGet(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  const userId = getUserIdFromJWT(authHeader);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: "Authentication required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const id = url.searchParams.get("id");

  const supabase = getSupabaseClient(authHeader);

  try {
    if (id) {
      // Fetch single boarding pass
      const { data, error } = await supabase
        .from("boarding_passes")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, error: "Boarding pass not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, boarding_pass: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "latest") {
      // Fetch most recent boarding pass
      const { data, error } = await supabase
        .from("boarding_passes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: true, boarding_pass: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, boarding_pass: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: list all boarding passes
    const { data, error } = await supabase
      .from("boarding_passes")
      .select("id, passenger_name, flight_number, airline, departure_airport_code, arrival_airport_code, departure_date, departure_time, seat, gate, travel_class, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, boarding_passes: data || [], count: (data || []).length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[get] Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Main Server
// ═══════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      return await handleScan(req);
    }

    if (req.method === "GET") {
      return await handleGet(req);
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[server] Unhandled error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
