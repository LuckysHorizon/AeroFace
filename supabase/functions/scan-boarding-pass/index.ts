// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ═══════════════════════════════════════════════════════════════════
//  AeroFace — scan-boarding-pass Edge Function v2
//
//  Endpoints:
//    POST  → Upload base64 image/PDF, OCR extract, store in DB
//    GET   → List user's boarding passes  (?action=list)
//    GET   → Get single boarding pass     (?id=UUID)
//    GET   → Get latest boarding pass     (?action=latest)
//
//  OCR: Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)
//  Supports: JPEG, PNG, PDF boarding passes
// ═══════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Comprehensive Airport Lookup (IATA codes) ──────────────────
const AIRPORT_LOOKUP: Record<string, string> = {
  // ─── India Major ───
  DEL: "Indira Gandhi International Airport, Delhi",
  BOM: "Chhatrapati Shivaji Maharaj Intl Airport, Mumbai",
  BLR: "Kempegowda International Airport, Bengaluru",
  HYD: "Rajiv Gandhi International Airport, Hyderabad",
  MAA: "Chennai International Airport",
  CCU: "Netaji Subhas Chandra Bose Intl Airport, Kolkata",
  COK: "Cochin International Airport, Kochi",
  AMD: "Sardar Vallabhbhai Patel Intl Airport, Ahmedabad",
  PNQ: "Pune Airport",
  GOI: "Goa International Airport",
  JAI: "Jaipur International Airport",
  LKO: "Chaudhary Charan Singh Intl Airport, Lucknow",
  GAU: "Lokpriya Gopinath Bordoloi Intl Airport, Guwahati",
  IXC: "Chandigarh Airport",
  PAT: "Jay Prakash Narayan Intl Airport, Patna",
  TRV: "Trivandrum International Airport",
  VTZ: "Visakhapatnam Airport",
  IXB: "Bagdogra Airport",
  SXR: "Sheikh ul-Alam Intl Airport, Srinagar",
  IDR: "Devi Ahilyabai Holkar Airport, Indore",
  // ─── India Additional ───
  NAG: "Dr. Babasaheb Ambedkar Intl Airport, Nagpur",
  BBI: "Biju Patnaik Intl Airport, Bhubaneswar",
  RPR: "Swami Vivekananda Airport, Raipur",
  IXR: "Birsa Munda Airport, Ranchi",
  VNS: "Lal Bahadur Shastri Intl Airport, Varanasi",
  IXA: "Agartala Airport",
  IMF: "Imphal Airport",
  CCJ: "Calicut International Airport",
  IXE: "Mangalore International Airport",
  IXM: "Madurai Airport",
  TRZ: "Tiruchirappalli Airport",
  CJB: "Coimbatore International Airport",
  RAJ: "Rajkot Airport",
  UDR: "Maharana Pratap Airport, Udaipur",
  BDQ: "Vadodara Airport",
  STV: "Surat Airport",
  DED: "Jolly Grant Airport, Dehradun",
  ATQ: "Sri Guru Ram Dass Jee Intl Airport, Amritsar",
  IXJ: "Jammu Airport",
  GWL: "Gwalior Airport",
  BHO: "Raja Bhoj Airport, Bhopal",
  JLR: "Jabalpur Airport",
  DHM: "Gaggal Airport, Dharamshala",
  KUU: "Bhuntar Airport, Kullu",
  IXL: "Kushok Bakula Rimpochee Airport, Leh",
  MOH: "Mopa International Airport, Goa",
  // ─── Middle East ───
  DXB: "Dubai International Airport",
  AUH: "Abu Dhabi International Airport",
  DOH: "Hamad International Airport, Doha",
  BAH: "Bahrain International Airport",
  MCT: "Muscat International Airport",
  KWI: "Kuwait International Airport",
  RUH: "King Khalid Intl Airport, Riyadh",
  JED: "King Abdulaziz Intl Airport, Jeddah",
  // ─── Southeast Asia ───
  SIN: "Singapore Changi Airport",
  BKK: "Suvarnabhumi Airport, Bangkok",
  KUL: "Kuala Lumpur International Airport",
  CGK: "Soekarno-Hatta Intl Airport, Jakarta",
  MNL: "Ninoy Aquino Intl Airport, Manila",
  HAN: "Noi Bai International Airport, Hanoi",
  SGN: "Tan Son Nhat Intl Airport, Ho Chi Minh City",
  // ─── Europe ───
  LHR: "London Heathrow Airport",
  LGW: "London Gatwick Airport",
  CDG: "Charles de Gaulle Airport, Paris",
  FRA: "Frankfurt Airport",
  AMS: "Amsterdam Schiphol Airport",
  FCO: "Leonardo da Vinci Airport, Rome",
  ZRH: "Zurich Airport",
  MUC: "Munich Airport",
  IST: "Istanbul Airport",
  // ─── North America ───
  JFK: "John F. Kennedy Intl Airport, New York",
  LAX: "Los Angeles International Airport",
  SFO: "San Francisco International Airport",
  ORD: "O'Hare International Airport, Chicago",
  EWR: "Newark Liberty Intl Airport",
  IAD: "Washington Dulles Intl Airport",
  YYZ: "Toronto Pearson Intl Airport",
  // ─── East Asia & Oceania ───
  HKG: "Hong Kong International Airport",
  NRT: "Narita International Airport, Tokyo",
  ICN: "Incheon International Airport, Seoul",
  PEK: "Beijing Capital International Airport",
  SYD: "Sydney Kingsford Smith Airport",
  MEL: "Melbourne Airport",
  CMB: "Bandaranaike Intl Airport, Colombo",
  KTM: "Tribhuvan International Airport, Kathmandu",
  DAC: "Hazrat Shahjalal Intl Airport, Dhaka",
  MLE: "Velana International Airport, Maldives",
};

// ── City Name → Airport Code mapping (for contextual matching) ─
const CITY_TO_CODE: Record<string, string> = {
  DELHI: "DEL", "NEW DELHI": "DEL", NEWDELHI: "DEL",
  MUMBAI: "BOM", BOMBAY: "BOM",
  BANGALORE: "BLR", BENGALURU: "BLR", BENGALORE: "BLR",
  HYDERABAD: "HYD",
  CHENNAI: "MAA", MADRAS: "MAA",
  KOLKATA: "CCU", CALCUTTA: "CCU",
  KOCHI: "COK", COCHIN: "COK",
  AHMEDABAD: "AMD",
  PUNE: "PNQ",
  GOA: "GOI", DABOLIM: "GOI", MOPA: "MOH",
  JAIPUR: "JAI",
  LUCKNOW: "LKO",
  GUWAHATI: "GAU",
  CHANDIGARH: "IXC",
  PATNA: "PAT",
  TRIVANDRUM: "TRV", THIRUVANANTHAPURAM: "TRV",
  VARANASI: "VNS", BANARAS: "VNS",
  NAGPUR: "NAG",
  BHUBANESWAR: "BBI",
  RANCHI: "IXR",
  RAIPUR: "RPR",
  INDORE: "IDR",
  AMRITSAR: "ATQ",
  COIMBATORE: "CJB",
  MANGALORE: "IXE", MANGALURU: "IXE",
  UDAIPUR: "UDR",
  SURAT: "STV",
  DEHRADUN: "DED",
  SRINAGAR: "SXR",
  LEH: "IXL",
  DUBAI: "DXB",
  SINGAPORE: "SIN",
  BANGKOK: "BKK",
  LONDON: "LHR",
  DOHA: "DOH",
  "ABU DHABI": "AUH", ABUDHABI: "AUH",
  MUSCAT: "MCT",
  KATHMANDU: "KTM",
  COLOMBO: "CMB",
  DHAKA: "DAC",
  MALDIVES: "MLE", MALE: "MLE",
  "KUALA LUMPUR": "KUL",
  JAKARTA: "CGK",
  "HO CHI MINH": "SGN",
  HANOI: "HAN",
  "HONG KONG": "HKG", HONGKONG: "HKG",
  TOKYO: "NRT",
  SEOUL: "ICN",
  PARIS: "CDG",
  FRANKFURT: "FRA",
  AMSTERDAM: "AMS",
  ZURICH: "ZRH",
  ISTANBUL: "IST",
  "NEW YORK": "JFK", NEWYORK: "JFK",
  "LOS ANGELES": "LAX",
  "SAN FRANCISCO": "SFO",
  CHICAGO: "ORD",
  TORONTO: "YYZ",
  SYDNEY: "SYD",
  MELBOURNE: "MEL",
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
  TG: "Thai Airways",
  MH: "Malaysia Airlines",
  CX: "Cathay Pacific",
  NH: "All Nippon Airways",
  JL: "Japan Airlines",
  KE: "Korean Air",
  TK: "Turkish Airlines",
  AF: "Air France",
  KL: "KLM Royal Dutch Airlines",
  LX: "Swiss International Air Lines",
  WY: "Oman Air",
  GF: "Gulf Air",
  UL: "SriLankan Airlines",
  RA: "Nepal Airlines",
  BG: "Biman Bangladesh Airlines",
  WZ: "Red Wings Airlines",
  FZ: "flydubai",
  WG: "Sunwing Airlines",
};

// ═══════════════════════════════════════════════════════════════════
//  Google Cloud Vision OCR (supports images + PDFs)
// ═══════════════════════════════════════════════════════════════════

async function callVisionOCR(
  base64Content: string,
  isPdf: boolean = false
): Promise<{ text: string; confidence: number }> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    throw new Error("Google API key not configured");
  }

  // Strip data URI prefix if present
  const cleanBase64 = base64Content.replace(/^data:[^;]+;base64,/, "");

  if (isPdf) {
    // ── PDF: use files:annotate endpoint ──
    const url = `https://vision.googleapis.com/v1/files:annotate?key=${apiKey}`;
    const requestBody = {
      requests: [
        {
          inputConfig: {
            mimeType: "application/pdf",
            content: cleanBase64,
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: [1, 2], // Scan first 2 pages
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
      console.error("[Vision API PDF Error]", errText);
      throw new Error("Vision API error: " + res.status);
    }

    const data = await res.json();
    const responses = data.responses?.[0]?.responses || [];

    // Combine text from all pages
    let fullText = "";
    let totalConfidence = 0;
    let blockCount = 0;

    for (const pageRes of responses) {
      const annotation = pageRes?.fullTextAnnotation;
      if (annotation?.text) {
        fullText += annotation.text + "\n";
        for (const page of annotation.pages || []) {
          for (const block of page.blocks || []) {
            if (block.confidence) {
              totalConfidence += block.confidence;
              blockCount++;
            }
          }
        }
      }
    }

    return {
      text: fullText.trim(),
      confidence: blockCount > 0 ? totalConfidence / blockCount : 0.5,
    };
  } else {
    // ── Image: use images:annotate endpoint ──
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const requestBody = {
      requests: [
        {
          image: { content: cleanBase64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
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
}

// ═══════════════════════════════════════════════════════════════════
//  Boarding Pass Text Parser v2 — Smart Airport Code Extraction
//
//  Strategy:
//   1. Score-based airport code detection using keyword proximity
//   2. City name → code resolution
//   3. Direct route patterns (DEL-BOM, DEL→BOM, DEL TO BOM)
//   4. Labeled fields (FROM: DEL, DEPARTURE: DEL)
//   5. Position-based fallback (first code = departure)
//
//  Exclusion list prevents false positives from common 3-letter words
// ═══════════════════════════════════════════════════════════════════

// Common 3-letter words that are NOT airport codes (false positive filter)
const EXCLUDED_WORDS = new Set([
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HAD",
  "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS",
  "HOW", "ITS", "MAY", "NEW", "NOW", "OLD", "SEE", "WAY", "WHO", "DID",
  "LET", "SAY", "SHE", "TOO", "USE", "MRS", "REF", "PNR", "ETD", "STD",
  "ETA", "STA", "ARR", "DEP", "FLT", "SEQ", "ROW", "BRD", "INR", "USD",
  "TAX", "FEE", "NET", "EST", "VIA", "AIR", "MAN", "PAX", "YES", "AGE",
  "END", "FLY", "RUN", "SET", "TRY", "ACE", "ADD", "AGO", "AID", "AIM",
  "APR", "AUG", "AVG", "BAN", "BAR", "BED", "BIG", "BIT", "BOX", "BUS",
  "CAR", "CUT", "DOC", "DUE", "EAR", "EAT", "ERA", "EVE", "EYE", "FAN",
  "FAR", "FAX", "FIG", "FIN", "FIT", "FIX", "FUN", "GAP", "GAS", "GUN",
  "GYM", "HAT", "HIT", "HOT", "ICE", "ILL", "INK", "INN", "JOB", "JOY",
  "KEY", "KID", "LAP", "LAW", "LAY", "LED", "LEG", "LID", "LIE", "LIP",
  "LOG", "LOT", "LOW", "MAP", "MAT", "MID", "MIX", "MOD", "MUD", "NAP",
  "NOR", "NOT", "NUT", "OAK", "ODD", "OFF", "OIL", "OPT", "OWE", "OWN",
  "PAN", "PAD", "PAY", "PEN", "PER", "PET", "PIE", "PIN", "PIT", "PLY",
  "POT", "PRO", "PUB", "PUR", "PUT", "RAN", "RAW", "RED", "RIB", "RID",
  "RIG", "RIM", "RIP", "ROD", "RUB", "RUG", "SAD", "SAT", "SAW", "SIT",
  "SIX", "SKI", "SKY", "SOP", "SOW", "SPY", "SUB", "SUM", "SUN", "TAP",
  "TEA", "TEN", "TIE", "TIN", "TIP", "TOE", "TON", "TOP", "TOW", "TUB",
  "TWO", "VAN", "VAT", "VET", "VOW", "WAR", "WEB", "WET", "WIG", "WIN",
  "WIT", "WOK", "WON", "WOO", "YEN", "YET", "ZAP", "ZEN", "ZIP", "ZOO",
  "NON", "NUM", "SEC", "MIN", "MAX", "AVE", "FRI", "MON", "TUE", "WED",
  "THU", "SAT", "SUN", "JAN", "FEB", "MAR", "JUN", "JUL", "OCT", "NOV",
  "DEC", "GMT", "IST",
]);

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
  // Prioritize known airline codes for accuracy
  let flightFound = false;
  for (const airlineCode of Object.keys(AIRLINE_LOOKUP)) {
    const escaped = airlineCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b(${escaped})\\s*(\\d{3,4})\\b`);
    const m = text.match(regex);
    if (m) {
      result.flight_number = m[1] + " " + m[2];
      result.airline = AIRLINE_LOOKUP[airlineCode];
      flightFound = true;
      break;
    }
  }
  if (!flightFound) {
    const flightMatch = text.match(/\b([A-Z0-9]{2})\s*(\d{3,4})\b/);
    if (flightMatch) {
      result.flight_number = flightMatch[1] + " " + flightMatch[2];
      if (AIRLINE_LOOKUP[flightMatch[1]]) {
        result.airline = AIRLINE_LOOKUP[flightMatch[1]];
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  SMART AIRPORT CODE EXTRACTION
  //  Uses scoring system + keyword proximity + city name resolution
  // ═══════════════════════════════════════════════════════════

  const DEP_KEYWORDS = [
    "FROM", "ORIGIN", "DEPARTURE", "DEPART", "DEP", "DEPARTING",
    "BOARDING AT", "DEPARTS FROM", "SOURCE", "CITY OF DEPARTURE",
  ];
  const ARR_KEYWORDS = [
    "TO", "DESTINATION", "DEST", "ARRIVAL", "ARRIVE", "ARR", "ARRIVING",
    "ARRIVING AT", "GOING TO", "CITY OF ARRIVAL",
  ];

  // Score each candidate: { code, depScore, arrScore, position }
  interface CodeCandidate {
    code: string;
    depScore: number;
    arrScore: number;
    lineIndex: number;
    charIndex: number;
  }

  const candidates: CodeCandidate[] = [];

  // ── Strategy 1: Direct route patterns (highest confidence) ──
  const routePatterns = [
    // "DEL - BOM", "DEL → BOM", "DEL -> BOM", "DEL — BOM", "DEL – BOM"
    /\b([A-Z]{3})\s*[-→\->–—]\s*([A-Z]{3})\b/,
    // "DEL TO BOM", "DEL / BOM"
    /\b([A-Z]{3})\s+TO\s+([A-Z]{3})\b/,
    /\b([A-Z]{3})\s*\/\s*([A-Z]{3})\b/,
    // "FROM DEL TO BOM"
    /FROM\s+([A-Z]{3})\s+TO\s+([A-Z]{3})/,
    // "ORIGIN: DEL DESTINATION: BOM"
    /ORIGIN\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,40}DEST(?:INATION)?\s*[:\-]?\s*([A-Z]{3})/,
    // "DEP: DEL ARR: BOM"
    /DEP(?:ARTURE|ART)?\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,40}ARR(?:IVAL|IVE)?\s*[:\-]?\s*([A-Z]{3})/,
    // "DEPARTURE AIRPORT: DEL ... ARRIVAL AIRPORT: BOM"
    /DEPARTURE\s*(?:AIRPORT|STATION)?\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,60}ARRIVAL\s*(?:AIRPORT|STATION)?\s*[:\-]?\s*([A-Z]{3})/,
  ];

  let routeFound = false;
  for (const pattern of routePatterns) {
    const m = text.match(pattern);
    if (m && m[1] && m[2]) {
      const code1 = m[1];
      const code2 = m[2];
      const code1Valid = AIRPORT_LOOKUP[code1] && !EXCLUDED_WORDS.has(code1);
      const code2Valid = AIRPORT_LOOKUP[code2] && !EXCLUDED_WORDS.has(code2);

      if (code1Valid && code2Valid) {
        result.departure_airport_code = code1;
        result.arrival_airport_code = code2;
        routeFound = true;
        console.log(`[parser] Route pattern matched: ${code1} → ${code2}`);
        break;
      }
      // Even if only one is in lookup, accept if the other code looks like IATA
      if (code1Valid && code2.length === 3 && !EXCLUDED_WORDS.has(code2)) {
        result.departure_airport_code = code1;
        result.arrival_airport_code = code2;
        routeFound = true;
        console.log(`[parser] Route pattern (partial lookup): ${code1} → ${code2}`);
        break;
      }
      if (code2Valid && code1.length === 3 && !EXCLUDED_WORDS.has(code1)) {
        result.departure_airport_code = code1;
        result.arrival_airport_code = code2;
        routeFound = true;
        console.log(`[parser] Route pattern (partial lookup): ${code1} → ${code2}`);
        break;
      }
    }
  }

  // ── Strategy 2: Labeled fields (FROM: DEL, DEPARTURE: BLR) ──
  if (!routeFound) {
    for (const line of lines) {
      // Check for departure keywords followed by a code
      for (const kw of DEP_KEYWORDS) {
        const depRegex = new RegExp(`${kw}\\s*[:\\-]?\\s*([A-Z]{3})\\b`);
        const dm = line.match(depRegex);
        if (dm && (AIRPORT_LOOKUP[dm[1]] || !EXCLUDED_WORDS.has(dm[1]))) {
          if (!result.departure_airport_code) {
            result.departure_airport_code = dm[1];
            console.log(`[parser] Labeled departure: ${kw} → ${dm[1]}`);
          }
        }
      }
      // Check for arrival keywords followed by a code
      for (const kw of ARR_KEYWORDS) {
        // Don't match "TO" alone as it's too common; require code context
        if (kw === "TO") {
          const toRegex = /\bTO\s*[:\-]\s*([A-Z]{3})\b/;
          const tm = line.match(toRegex);
          if (tm && (AIRPORT_LOOKUP[tm[1]] || !EXCLUDED_WORDS.has(tm[1]))) {
            if (!result.arrival_airport_code) {
              result.arrival_airport_code = tm[1];
              console.log(`[parser] Labeled arrival: TO → ${tm[1]}`);
            }
          }
        } else {
          const arrRegex = new RegExp(`${kw}\\s*[:\\-]?\\s*([A-Z]{3})\\b`);
          const am = line.match(arrRegex);
          if (am && (AIRPORT_LOOKUP[am[1]] || !EXCLUDED_WORDS.has(am[1]))) {
            if (!result.arrival_airport_code) {
              result.arrival_airport_code = am[1];
              console.log(`[parser] Labeled arrival: ${kw} → ${am[1]}`);
            }
          }
        }
      }
    }
  }

  // ── Strategy 3: City name resolution ──
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    // Find city names in text that map to airport codes
    const foundCities: { city: string; code: string; index: number; depScore: number; arrScore: number }[] = [];

    for (const [city, code] of Object.entries(CITY_TO_CODE)) {
      const cityRegex = new RegExp(`\\b${city}\\b`, "g");
      let cm;
      while ((cm = cityRegex.exec(text)) !== null) {
        // Check surrounding text for departure/arrival context
        const surroundStart = Math.max(0, cm.index - 60);
        const surroundEnd = Math.min(text.length, cm.index + city.length + 60);
        const surrounding = text.substring(surroundStart, surroundEnd);

        let depScore = 0;
        let arrScore = 0;

        for (const kw of DEP_KEYWORDS) {
          if (surrounding.includes(kw)) depScore += 3;
        }
        for (const kw of ARR_KEYWORDS) {
          if (kw !== "TO" && surrounding.includes(kw)) arrScore += 3;
        }

        foundCities.push({ city, code, index: cm.index, depScore, arrScore });
      }
    }

    if (foundCities.length >= 2) {
      // Sort by position in text (departure usually first)
      foundCities.sort((a, b) => a.index - b.index);

      // Use scores if available, otherwise position-based
      const depCity = foundCities.reduce((best, c) =>
        c.depScore > best.depScore ? c : best, foundCities[0]);
      const arrCity = foundCities.find(c => c.code !== depCity.code) || foundCities[1];

      if (!result.departure_airport_code) {
        result.departure_airport_code = depCity.code;
        console.log(`[parser] City-based departure: ${depCity.city} → ${depCity.code}`);
      }
      if (!result.arrival_airport_code && arrCity && arrCity.code !== result.departure_airport_code) {
        result.arrival_airport_code = arrCity.code;
        console.log(`[parser] City-based arrival: ${arrCity.city} → ${arrCity.code}`);
      }
    } else if (foundCities.length === 1 && !result.departure_airport_code) {
      result.departure_airport_code = foundCities[0].code;
      console.log(`[parser] City-based (single): ${foundCities[0].city} → ${foundCities[0].code}`);
    }
  }

  // ── Strategy 4: Score-based 3-letter code proximity scan ──
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const codeRegex = /\b([A-Z]{3})\b/g;
      let cm;
      while ((cm = codeRegex.exec(line)) !== null) {
        const code = cm[1];
        if (!AIRPORT_LOOKUP[code] || EXCLUDED_WORDS.has(code)) continue;

        // Score based on proximity to keywords on THIS line and adjacent lines
        let depScore = 0;
        let arrScore = 0;
        const context = [
          li > 0 ? lines[li - 1] : "",
          line,
          li < lines.length - 1 ? lines[li + 1] : "",
        ].join(" ");

        for (const kw of DEP_KEYWORDS) {
          if (context.includes(kw)) depScore += 2;
        }
        for (const kw of ARR_KEYWORDS) {
          if (kw !== "TO" && context.includes(kw)) arrScore += 2;
        }

        // Codes appearing near "TERMINAL" or "GATE" are likely departure
        if (context.includes("TERMINAL") || context.includes("GATE")) depScore += 1;

        candidates.push({
          code,
          depScore,
          arrScore,
          lineIndex: li,
          charIndex: cm.index,
        });
      }
    }

    if (candidates.length > 0) {
      // Remove duplicates, keep highest scored instance
      const uniqueCodes = new Map<string, CodeCandidate>();
      for (const c of candidates) {
        const existing = uniqueCodes.get(c.code);
        if (!existing || (c.depScore + c.arrScore) > (existing.depScore + existing.arrScore)) {
          uniqueCodes.set(c.code, c);
        }
      }

      const sortedCandidates = Array.from(uniqueCodes.values());

      if (!result.departure_airport_code) {
        // Pick the candidate with highest departure score
        const depCandidate = sortedCandidates.reduce((best, c) => {
          if (c.depScore > best.depScore) return c;
          if (c.depScore === best.depScore && c.lineIndex < best.lineIndex) return c;
          return best;
        });
        result.departure_airport_code = depCandidate.code;
        console.log(`[parser] Scored departure: ${depCandidate.code} (depScore=${depCandidate.depScore})`);

        if (!result.arrival_airport_code) {
          // Pick the best arrival candidate that isn't the departure
          const arrCandidates = sortedCandidates.filter(c => c.code !== depCandidate.code);
          if (arrCandidates.length > 0) {
            const arrCandidate = arrCandidates.reduce((best, c) => {
              if (c.arrScore > best.arrScore) return c;
              if (c.arrScore === best.arrScore && c.lineIndex > best.lineIndex) return c;
              return best;
            });
            result.arrival_airport_code = arrCandidate.code;
            console.log(`[parser] Scored arrival: ${arrCandidate.code} (arrScore=${arrCandidate.arrScore})`);
          }
        }
      } else if (!result.arrival_airport_code) {
        const arrCandidates = sortedCandidates.filter(c => c.code !== result.departure_airport_code);
        if (arrCandidates.length > 0) {
          const arrCandidate = arrCandidates.reduce((best, c) =>
            c.arrScore > best.arrScore ? c : best);
          result.arrival_airport_code = arrCandidate.code;
        }
      }
    }
  }

  // ── Strategy 5: Check for airport code + city name together ──
  // e.g., "DEL (DELHI)" or "DELHI DEL" or "DEL DELHI"
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    const codeWithCityPattern = /\b([A-Z]{3})\s*[\(\[]\s*([A-Z]+)\s*[\)\]]|\b([A-Z]+)\s*[\(\[]\s*([A-Z]{3})\s*[\)\]]/g;
    let pcm;
    const pairCodes: string[] = [];
    while ((pcm = codeWithCityPattern.exec(text)) !== null) {
      const code = pcm[1] || pcm[4];
      if (code && AIRPORT_LOOKUP[code] && !EXCLUDED_WORDS.has(code)) {
        pairCodes.push(code);
      }
    }
    if (!result.departure_airport_code && pairCodes.length >= 1) {
      result.departure_airport_code = pairCodes[0];
    }
    if (!result.arrival_airport_code && pairCodes.length >= 2) {
      result.arrival_airport_code = pairCodes[1];
    }
  }

  // Resolve airport names
  if (result.departure_airport_code && AIRPORT_LOOKUP[result.departure_airport_code]) {
    result.departure_airport_name = AIRPORT_LOOKUP[result.departure_airport_code];
  }
  if (result.arrival_airport_code && AIRPORT_LOOKUP[result.arrival_airport_code]) {
    result.arrival_airport_name = AIRPORT_LOOKUP[result.arrival_airport_code];
  }

  console.log(`[parser] Final airports: DEP=${result.departure_airport_code} (${result.departure_airport_name}), ARR=${result.arrival_airport_code} (${result.arrival_airport_name})`);

  // ── Passenger Name ────────────────────────────────────────
  const namePatterns = [
    /(?:NAME|PASSENGER|PAX|TRAVELL?ER)\s*[:\-]?\s*(?:MR|MRS|MS|MISS|DR|MSTR)?\s*([A-Z][A-Z\s\/\.]{2,30})/,
    /(?:BOARDING\s*PASS|E-?TICKET)[\s\S]{0,30}(?:MR|MRS|MS|MISS|DR)\s+([A-Z][A-Z\s]{2,25})/,
  ];
  for (const np of namePatterns) {
    const nameMatch = text.match(np);
    if (nameMatch) {
      result.passenger_name = nameMatch[1].trim().replace(/\s+/g, " ");
      break;
    }
  }
  if (!result.passenger_name) {
    // "LASTNAME/FIRSTNAME" format (very common in boarding passes)
    const slashName = text.match(/\b([A-Z]{2,20})\/([A-Z]{2,20}(?:\s+[A-Z]+)?)\b/);
    if (slashName) {
      result.passenger_name = slashName[2] + " " + slashName[1];
    }
  }

  // ── Seat ──────────────────────────────────────────────────
  const seatMatch = text.match(/(?:SEAT|ST|SEAT\s*NO)\s*[:\-]?\s*(\d{1,2}[A-F])\b/);
  if (seatMatch) {
    result.seat = seatMatch[1];
  } else {
    // Look for seat pattern near the word SEAT on the same or adjacent line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("SEAT")) {
        const seatInLine = lines[i].match(/\b(\d{1,2}[A-F])\b/);
        if (seatInLine) {
          result.seat = seatInLine[1];
          break;
        }
        // Check next line too
        if (i + 1 < lines.length) {
          const seatNextLine = lines[i + 1].match(/\b(\d{1,2}[A-F])\b/);
          if (seatNextLine) {
            result.seat = seatNextLine[1];
            break;
          }
        }
      }
    }
  }

  // ── Gate ──────────────────────────────────────────────────
  const gateMatch = text.match(/GATE\s*[:\-]?\s*([A-Z]?\d{1,3}[A-Z]?)\b/);
  if (gateMatch) {
    result.gate = gateMatch[1];
  }

  // ── Date ──────────────────────────────────────────────────
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };

  const datePatterns = [
    /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*[',]?\s*(\d{2,4})/,
    /(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
  ];

  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      if (months[dateMatch[2]]) {
        const day = dateMatch[1].padStart(2, "0");
        const month = months[dateMatch[2]];
        let year = dateMatch[3];
        if (year.length === 2) year = "20" + year;
        result.departure_date = `${year}-${month}-${day}`;
      } else if (dateMatch[1].length === 4) {
        result.departure_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      } else {
        let year = dateMatch[3];
        if (year.length === 2) year = "20" + year;
        result.departure_date = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
      }
      break;
    }
  }

  // ── Time (departure & boarding) ───────────────────────────
  // First try labeled patterns (most reliable)
  const boardTimeMatch = text.match(/BOARD(?:ING)?\s*(?:TIME)?\s*[:\-]?\s*(\d{2})[:\.](\d{2})/);
  if (boardTimeMatch) {
    result.boarding_time = boardTimeMatch[1] + ":" + boardTimeMatch[2];
  }
  const depTimeMatch = text.match(/(?:DEPART(?:URE)?|DEP|ETD|STD)\s*(?:TIME)?\s*[:\-]?\s*(\d{2})[:\.](\d{2})/);
  if (depTimeMatch) {
    result.departure_time = depTimeMatch[1] + ":" + depTimeMatch[2];
  }

  // Fallback: collect all HH:MM patterns
  if (!result.departure_time) {
    const timeMatches = text.matchAll(/\b(\d{2})[:\.](\d{2})\b/g);
    const times: string[] = [];
    for (const m of timeMatches) {
      const h = parseInt(m[1]);
      const mm = parseInt(m[2]);
      if (h >= 0 && h <= 23 && mm >= 0 && mm <= 59) {
        times.push(m[1] + ":" + m[2]);
      }
    }
    if (times.length >= 2) {
      if (!result.boarding_time) result.boarding_time = times[0];
      result.departure_time = times[1];
    } else if (times.length === 1) {
      result.departure_time = times[0];
    }
  }

  // ── PNR / Booking Reference ───────────────────────────────
  const pnrMatch = text.match(
    /(?:PNR|BOOKING\s*REF(?:ERENCE)?|CONFIRM(?:ATION)?(?:\s*CODE)?|RECORD\s*LOC(?:ATOR)?|CONF\s*NO)\s*[:\-]?\s*([A-Z0-9]{5,8})/
  );
  if (pnrMatch) {
    result.booking_reference = pnrMatch[1];
  }

  // ── Travel Class ──────────────────────────────────────────
  const classMatch = text.match(
    /(?:CLASS|CL|CABIN|TRAVEL\s*CLASS)\s*[:\-]?\s*(ECONOMY|BUSINESS|FIRST|PREMIUM(?:\s*ECONOMY)?|ECON|BUS|[YJCF])\b/
  );
  if (classMatch) {
    const classMap: Record<string, string> = {
      Y: "Economy", ECON: "Economy", ECONOMY: "Economy",
      J: "Business", BUS: "Business", BUSINESS: "Business",
      C: "Business",
      F: "First", FIRST: "First",
    };
    result.travel_class = classMap[classMatch[1]] || classMatch[1];
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
  const { image_base64, pdf_base64 } = body;
  const isPdf = !!pdf_base64;
  const content = pdf_base64 || image_base64;

  if (!content) {
    return new Response(
      JSON.stringify({ success: false, error: "image_base64 or pdf_base64 is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Run OCR (supports both image and PDF)
    console.log("[scan] Running OCR for user:", userId, "type:", isPdf ? "PDF" : "Image");
    const { text: rawText, confidence } = await callVisionOCR(content, isPdf);

    if (!rawText) {
      return new Response(
        JSON.stringify({
          success: false,
          error: isPdf
            ? "Could not extract text from PDF. Please try a clearer file."
            : "Could not extract text from image. Please try a clearer photo.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[scan] OCR text length:", rawText.length, "confidence:", confidence.toFixed(2));
    console.log("[scan] Raw OCR text preview:", rawText.substring(0, 500));

    // 2. Parse extracted text
    const parsed = parseBoardingPassText(rawText);
    console.log("[scan] Parsed:", JSON.stringify(parsed));

    // 3. Upload file to Supabase Storage
    const supabase = getSupabaseClient(authHeader);
    const cleanBase64 = content.replace(/^data:[^;]+;base64,/, "");
    const fileBytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    const ext = isPdf ? "pdf" : "jpg";
    const mimeType = isPdf ? "application/pdf" : "image/jpeg";
    const fileName = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("boarding-passes")
      .upload(fileName, fileBytes, { contentType: mimeType, upsert: false });

    let imageUrl: string | null = null;
    if (uploadErr) {
      console.error("[scan] Storage upload error:", uploadErr.message);
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
