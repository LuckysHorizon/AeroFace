// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ═══════════════════════════════════════════════════════════════════
//  AeroFace — scan-boarding-pass Edge Function v6
//
//  Universal Boarding Pass Parser — works with ANY airport worldwide
//
//  Architecture (v6):
//   PRIMARY:  Raw image/PDF → Gemini Vision (multimodal) → JSON
//            Single API call, no intermediate OCR needed.
//   FALLBACK: Vision API OCR → regex parser
//            Used only if Gemini is unavailable.
//   Gemini reads the boarding pass directly and returns structured data.
//   No hardcoded airport lists needed for detection.
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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════
//  Comprehensive IATA Airport Database (400+ airports)
//  Used for NAME RESOLUTION. Detection works even for codes NOT here.
// ═══════════════════════════════════════════════════════════════════
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
  GOI: "Goa International Airport (Dabolim)",
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
  JSA: "Jaisalmer Airport",
  IXU: "Chikkalthana Airport, Aurangabad",
  DIB: "Dibrugarh Airport",
  JRH: "Jorhat Airport",
  // ─── Middle East ───
  DXB: "Dubai International Airport",
  AUH: "Abu Dhabi International Airport",
  SHJ: "Sharjah International Airport",
  DOH: "Hamad International Airport, Doha",
  BAH: "Bahrain International Airport",
  MCT: "Muscat International Airport",
  KWI: "Kuwait International Airport",
  RUH: "King Khalid Intl Airport, Riyadh",
  JED: "King Abdulaziz Intl Airport, Jeddah",
  DMM: "King Fahd International Airport, Dammam",
  MED: "Prince Mohammad bin Abdulaziz Intl Airport, Medina",
  TLV: "Ben Gurion Airport, Tel Aviv",
  AMM: "Queen Alia International Airport, Amman",
  BGW: "Baghdad International Airport",
  BSR: "Basra International Airport",
  IKA: "Imam Khomeini Intl Airport, Tehran",
  THR: "Mehrabad Airport, Tehran",
  ISB: "Islamabad International Airport",
  KHI: "Jinnah International Airport, Karachi",
  LHE: "Allama Iqbal Intl Airport, Lahore",
  // ─── Southeast Asia ───
  SIN: "Singapore Changi Airport",
  BKK: "Suvarnabhumi Airport, Bangkok",
  DMK: "Don Mueang International Airport, Bangkok",
  KUL: "Kuala Lumpur International Airport",
  CGK: "Soekarno-Hatta Intl Airport, Jakarta",
  MNL: "Ninoy Aquino Intl Airport, Manila",
  CEB: "Mactan-Cebu International Airport",
  HAN: "Noi Bai International Airport, Hanoi",
  SGN: "Tan Son Nhat Intl Airport, Ho Chi Minh City",
  DAD: "Da Nang International Airport",
  HKT: "Phuket International Airport",
  CNX: "Chiang Mai International Airport",
  USM: "Koh Samui Airport",
  RGN: "Yangon International Airport",
  PNH: "Phnom Penh International Airport",
  REP: "Siem Reap International Airport",
  VTE: "Wattay International Airport, Vientiane",
  BWN: "Brunei International Airport",
  DPS: "Ngurah Rai International Airport, Bali",
  SUB: "Juanda International Airport, Surabaya",
  PEN: "Penang International Airport",
  LGK: "Langkawi International Airport",
  // ─── East Asia ───
  HKG: "Hong Kong International Airport",
  NRT: "Narita International Airport, Tokyo",
  HND: "Haneda Airport, Tokyo",
  KIX: "Kansai International Airport, Osaka",
  ITM: "Osaka Itami Airport",
  FUK: "Fukuoka Airport",
  NGO: "Chubu Centrair Intl Airport, Nagoya",
  CTS: "New Chitose Airport, Sapporo",
  ICN: "Incheon International Airport, Seoul",
  GMP: "Gimpo International Airport, Seoul",
  PUS: "Gimhae International Airport, Busan",
  PEK: "Beijing Capital International Airport",
  PKX: "Beijing Daxing International Airport",
  PVG: "Shanghai Pudong International Airport",
  SHA: "Shanghai Hongqiao International Airport",
  CAN: "Guangzhou Baiyun International Airport",
  SZX: "Shenzhen Bao'an International Airport",
  CTU: "Chengdu Tianfu International Airport",
  WUH: "Wuhan Tianhe International Airport",
  XIY: "Xi'an Xianyang International Airport",
  HGH: "Hangzhou Xiaoshan International Airport",
  NKG: "Nanjing Lukou International Airport",
  CKG: "Chongqing Jiangbei International Airport",
  TPE: "Taiwan Taoyuan International Airport",
  KHH: "Kaohsiung International Airport",
  MFM: "Macau International Airport",
  UBN: "Chinggis Khaan Intl Airport, Ulaanbaatar",
  // ─── South Asia ───
  CMB: "Bandaranaike Intl Airport, Colombo",
  KTM: "Tribhuvan International Airport, Kathmandu",
  DAC: "Hazrat Shahjalal Intl Airport, Dhaka",
  MLE: "Velana International Airport, Maldives",
  // ─── Europe (UK & Ireland) ───
  LHR: "London Heathrow Airport",
  LGW: "London Gatwick Airport",
  STN: "London Stansted Airport",
  LTN: "London Luton Airport",
  LCY: "London City Airport",
  MAN: "Manchester Airport",
  BHX: "Birmingham Airport",
  EDI: "Edinburgh Airport",
  GLA: "Glasgow Airport",
  BRS: "Bristol Airport",
  BFS: "Belfast International Airport",
  DUB: "Dublin Airport",
  SNN: "Shannon Airport, Ireland",
  ORK: "Cork Airport, Ireland",
  // ─── Europe (France) ───
  CDG: "Charles de Gaulle Airport, Paris",
  ORY: "Paris Orly Airport",
  NCE: "Nice Côte d'Azur Airport",
  LYS: "Lyon-Saint Exupéry Airport",
  MRS: "Marseille Provence Airport",
  TLS: "Toulouse-Blagnac Airport",
  BOD: "Bordeaux-Mérignac Airport",
  NTE: "Nantes Atlantique Airport",
  // ─── Europe (Germany) ───
  FRA: "Frankfurt Airport",
  MUC: "Munich Airport",
  BER: "Berlin Brandenburg Airport",
  HAM: "Hamburg Airport",
  DUS: "Düsseldorf Airport",
  CGN: "Cologne Bonn Airport",
  STR: "Stuttgart Airport",
  // ─── Europe (Benelux) ───
  AMS: "Amsterdam Schiphol Airport",
  EIN: "Eindhoven Airport",
  BRU: "Brussels Airport",
  LUX: "Luxembourg Airport",
  // ─── Europe (Italy) ───
  FCO: "Leonardo da Vinci Airport, Rome",
  MXP: "Milan Malpensa Airport",
  LIN: "Milan Linate Airport",
  VCE: "Venice Marco Polo Airport",
  NAP: "Naples International Airport",
  BLQ: "Bologna Guglielmo Marconi Airport",
  PSA: "Pisa International Airport",
  CTA: "Catania-Fontanarossa Airport",
  PMO: "Palermo Airport",
  // ─── Europe (Switzerland & Austria) ───
  ZRH: "Zurich Airport",
  GVA: "Geneva Airport",
  BSL: "Basel-Mulhouse Airport",
  VIE: "Vienna International Airport",
  SZG: "Salzburg Airport",
  INN: "Innsbruck Airport",
  // ─── Europe (Iberian Peninsula) ───
  MAD: "Adolfo Suárez Madrid-Barajas Airport",
  BCN: "Barcelona-El Prat Airport",
  AGP: "Málaga Airport",
  PMI: "Palma de Mallorca Airport",
  VLC: "Valencia Airport",
  SVQ: "Seville Airport",
  BIO: "Bilbao Airport",
  LIS: "Lisbon Humberto Delgado Airport",
  OPO: "Porto Airport",
  FAO: "Faro Airport",
  // ─── Europe (Turkey) ───
  IST: "Istanbul Airport",
  SAW: "Istanbul Sabiha Gökçen Airport",
  ESB: "Ankara Esenboğa Airport",
  AYT: "Antalya Airport",
  ADB: "Izmir Adnan Menderes Airport",
  // ─── Europe (Scandinavia) ───
  OSL: "Oslo Gardermoen Airport",
  CPH: "Copenhagen Airport",
  ARN: "Stockholm Arlanda Airport",
  GOT: "Göteborg Landvetter Airport",
  HEL: "Helsinki-Vantaa Airport",
  BGO: "Bergen Flesland Airport",
  // ─── Europe (Eastern) ───
  PRG: "Václav Havel Airport Prague",
  BUD: "Budapest Ferenc Liszt Intl Airport",
  WAW: "Warsaw Chopin Airport",
  KRK: "Kraków John Paul II Intl Airport",
  OTP: "Bucharest Henri Coandă Airport",
  SOF: "Sofia Airport",
  BEG: "Belgrade Nikola Tesla Airport",
  ZAG: "Zagreb Airport",
  TLL: "Tallinn Airport",
  RIX: "Riga International Airport",
  VNO: "Vilnius Airport",
  LJU: "Ljubljana Jože Pučnik Airport",
  SKP: "Skopje Alexander the Great Airport",
  TIA: "Tirana International Airport",
  // ─── Europe (Greece) ───
  ATH: "Athens International Airport",
  SKG: "Thessaloniki Airport",
  HER: "Heraklion International Airport, Crete",
  RHO: "Diagoras Airport, Rhodes",
  CFU: "Corfu International Airport",
  JTR: "Santorini Airport",
  JMK: "Mykonos Airport",
  // ─── Europe (Nordic/Other) ───
  KEF: "Keflavík International Airport, Reykjavik",
  // ─── Russia & CIS ───
  SVO: "Sheremetyevo International Airport, Moscow",
  DME: "Domodedovo International Airport, Moscow",
  VKO: "Vnukovo International Airport, Moscow",
  LED: "Pulkovo Airport, St. Petersburg",
  SVX: "Koltsovo Airport, Yekaterinburg",
  OVB: "Tolmachevo Airport, Novosibirsk",
  KZN: "Kazan International Airport",
  // ─── Central Asia ───
  TAS: "Tashkent International Airport",
  ALA: "Almaty International Airport",
  NQZ: "Nursultan Nazarbayev Intl Airport, Astana",
  GYD: "Heydar Aliyev International Airport, Baku",
  TBS: "Shota Rustaveli Tbilisi Intl Airport",
  EVN: "Zvartnots International Airport, Yerevan",
  // ─── Africa ───
  JNB: "O.R. Tambo International Airport, Johannesburg",
  CPT: "Cape Town International Airport",
  DUR: "King Shaka International Airport, Durban",
  CAI: "Cairo International Airport",
  HRG: "Hurghada International Airport",
  SSH: "Sharm el-Sheikh International Airport",
  ADD: "Addis Ababa Bole International Airport",
  NBO: "Jomo Kenyatta Intl Airport, Nairobi",
  MBA: "Moi International Airport, Mombasa",
  LOS: "Murtala Muhammed Intl Airport, Lagos",
  ABV: "Nnamdi Azikiwe Intl Airport, Abuja",
  ACC: "Kotoka International Airport, Accra",
  DAR: "Julius Nyerere Intl Airport, Dar es Salaam",
  CMN: "Mohammed V International Airport, Casablanca",
  ALG: "Houari Boumediene Airport, Algiers",
  TUN: "Tunis-Carthage International Airport",
  MPM: "Maputo International Airport",
  LUN: "Kenneth Kaunda Intl Airport, Lusaka",
  HRE: "Robert Gabriel Mugabe Intl Airport, Harare",
  EBB: "Entebbe International Airport, Uganda",
  KGL: "Kigali International Airport, Rwanda",
  DSS: "Blaise Diagne International Airport, Dakar",
  TNR: "Ivato International Airport, Antananarivo",
  MRU: "Sir Seewoosagur Ramgoolam Intl Airport, Mauritius",
  // ─── North America (USA) ───
  JFK: "John F. Kennedy Intl Airport, New York",
  EWR: "Newark Liberty International Airport",
  LGA: "LaGuardia Airport, New York",
  LAX: "Los Angeles International Airport",
  SFO: "San Francisco International Airport",
  ORD: "O'Hare International Airport, Chicago",
  ATL: "Hartsfield-Jackson Atlanta Intl Airport",
  DFW: "Dallas/Fort Worth International Airport",
  DEN: "Denver International Airport",
  MIA: "Miami International Airport",
  SEA: "Seattle-Tacoma International Airport",
  CLT: "Charlotte Douglas Intl Airport",
  PHX: "Phoenix Sky Harbor Intl Airport",
  MSP: "Minneapolis-Saint Paul Intl Airport",
  DTW: "Detroit Metro Wayne County Airport",
  BOS: "Boston Logan International Airport",
  FLL: "Fort Lauderdale-Hollywood Intl Airport",
  MCO: "Orlando International Airport",
  SAN: "San Diego International Airport",
  TPA: "Tampa International Airport",
  PHL: "Philadelphia International Airport",
  BWI: "Baltimore/Washington Intl Airport",
  IAD: "Washington Dulles Intl Airport",
  DCA: "Ronald Reagan Washington National Airport",
  PDX: "Portland International Airport",
  AUS: "Austin-Bergstrom International Airport",
  SLC: "Salt Lake City International Airport",
  IAH: "George Bush Intercontinental, Houston",
  HOU: "William P. Hobby Airport, Houston",
  BNA: "Nashville International Airport",
  RDU: "Raleigh-Durham International Airport",
  SJC: "San José International Airport",
  OAK: "Oakland International Airport",
  STL: "St. Louis Lambert Intl Airport",
  MCI: "Kansas City International Airport",
  IND: "Indianapolis International Airport",
  CMH: "John Glenn Columbus Intl Airport",
  PIT: "Pittsburgh International Airport",
  CVG: "Cincinnati/Northern Kentucky Intl Airport",
  MKE: "Milwaukee Mitchell Intl Airport",
  SAT: "San Antonio International Airport",
  HNL: "Daniel K. Inouye Intl Airport, Honolulu",
  ANC: "Ted Stevens Anchorage Intl Airport",
  // ─── North America (Canada) ───
  YYZ: "Toronto Pearson International Airport",
  YVR: "Vancouver International Airport",
  YUL: "Montréal-Trudeau International Airport",
  YOW: "Ottawa Macdonald-Cartier Intl Airport",
  YWG: "Winnipeg James Armstrong Intl Airport",
  YEG: "Edmonton International Airport",
  YYC: "Calgary International Airport",
  YHZ: "Halifax Stanfield International Airport",
  // ─── Latin America & Caribbean ───
  MEX: "Mexico City International Airport",
  CUN: "Cancún International Airport",
  GDL: "Guadalajara International Airport",
  GRU: "São Paulo–Guarulhos International Airport",
  GIG: "Rio de Janeiro–Galeão Intl Airport",
  BSB: "Brasília International Airport",
  CNF: "Belo Horizonte Confins Intl Airport",
  SSA: "Salvador Deputado Luís Eduardo Magalhães Intl Airport",
  REC: "Recife/Guararapes Intl Airport",
  CWB: "Curitiba Afonso Pena Intl Airport",
  POA: "Porto Alegre Salgado Filho Intl Airport",
  EZE: "Ministro Pistarini Intl Airport, Buenos Aires",
  AEP: "Aeroparque Jorge Newbery, Buenos Aires",
  COR: "Córdoba Airport, Argentina",
  SCL: "Arturo Merino Benítez Intl Airport, Santiago",
  LIM: "Jorge Chávez International Airport, Lima",
  BOG: "El Dorado International Airport, Bogotá",
  MDE: "José María Córdova Intl Airport, Medellín",
  CLO: "Alfonso Bonilla Aragón Intl Airport, Cali",
  UIO: "Mariscal Sucre Intl Airport, Quito",
  GYE: "José Joaquín de Olmedo Intl Airport, Guayaquil",
  PTY: "Tocumen International Airport, Panama City",
  SJO: "Juan Santamaría Intl Airport, San José",
  HAV: "José Martí International Airport, Havana",
  SDQ: "Las Américas Intl Airport, Santo Domingo",
  PUJ: "Punta Cana International Airport",
  KIN: "Norman Manley Intl Airport, Kingston",
  MBJ: "Sangster International Airport, Montego Bay",
  MVD: "Carrasco International Airport, Montevideo",
  ASU: "Silvio Pettirossi Intl Airport, Asunción",
  VVI: "Viru Viru International Airport, Santa Cruz",
  LPB: "El Alto International Airport, La Paz",
  CCS: "Simón Bolívar Intl Airport, Caracas",
  // ─── Oceania ───
  SYD: "Sydney Kingsford Smith Airport",
  MEL: "Melbourne Tullamarine Airport",
  BNE: "Brisbane Airport",
  PER: "Perth Airport",
  ADL: "Adelaide Airport",
  CBR: "Canberra Airport",
  OOL: "Gold Coast Airport",
  CNS: "Cairns Airport",
  AKL: "Auckland Airport",
  WLG: "Wellington Airport",
  CHC: "Christchurch Airport",
  ZQN: "Queenstown Airport",
  NAN: "Nadi International Airport, Fiji",
  PPT: "Faa'a International Airport, Tahiti",
  ACE: "César Manrique–Lanzarote Airport",
  VAN: "Van Ferit Melen Airport, Turkey",
};

// ── City Name → Airport Code mapping (for contextual matching) ─
const CITY_TO_CODE: Record<string, string> = {
  // India
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
  VISAKHAPATNAM: "VTZ", VIZAG: "VTZ",
  BHOPAL: "BHO",
  // Middle East
  DUBAI: "DXB",
  "ABU DHABI": "AUH", ABUDHABI: "AUH",
  SHARJAH: "SHJ",
  DOHA: "DOH",
  MUSCAT: "MCT",
  KUWAIT: "KWI",
  RIYADH: "RUH",
  JEDDAH: "JED",
  DAMMAM: "DMM",
  MEDINA: "MED",
  "TEL AVIV": "TLV", TELAVIV: "TLV",
  AMMAN: "AMM",
  BAGHDAD: "BGW",
  TEHRAN: "IKA",
  ISLAMABAD: "ISB",
  KARACHI: "KHI",
  LAHORE: "LHE",
  // Southeast Asia
  SINGAPORE: "SIN",
  BANGKOK: "BKK",
  "KUALA LUMPUR": "KUL", KUALALUMPUR: "KUL",
  JAKARTA: "CGK",
  MANILA: "MNL",
  CEBU: "CEB",
  "HO CHI MINH": "SGN", SAIGON: "SGN",
  HANOI: "HAN",
  "DA NANG": "DAD", DANANG: "DAD",
  PHUKET: "HKT",
  "CHIANG MAI": "CNX", CHIANGMAI: "CNX",
  YANGON: "RGN", RANGOON: "RGN",
  "PHNOM PENH": "PNH", PHNOMPENH: "PNH",
  "SIEM REAP": "REP", SIEMREAP: "REP",
  BALI: "DPS", DENPASAR: "DPS",
  PENANG: "PEN",
  // East Asia
  "HONG KONG": "HKG", HONGKONG: "HKG",
  TOKYO: "NRT",
  OSAKA: "KIX",
  SEOUL: "ICN",
  BEIJING: "PEK",
  SHANGHAI: "PVG",
  GUANGZHOU: "CAN",
  SHENZHEN: "SZX",
  CHENGDU: "CTU",
  TAIPEI: "TPE",
  MACAU: "MFM",
  "ULAANBAATAR": "UBN",
  // South Asia
  COLOMBO: "CMB",
  KATHMANDU: "KTM",
  DHAKA: "DAC",
  MALDIVES: "MLE", MALE: "MLE",
  // Europe
  LONDON: "LHR",
  MANCHESTER: "MAN",
  EDINBURGH: "EDI",
  DUBLIN: "DUB",
  PARIS: "CDG",
  NICE: "NCE",
  FRANKFURT: "FRA",
  MUNICH: "MUC",
  BERLIN: "BER",
  HAMBURG: "HAM",
  AMSTERDAM: "AMS",
  BRUSSELS: "BRU",
  ROME: "FCO", ROMA: "FCO",
  MILAN: "MXP", MILANO: "MXP",
  VENICE: "VCE", VENEZIA: "VCE",
  NAPLES: "NAP", NAPOLI: "NAP",
  ZURICH: "ZRH",
  GENEVA: "GVA",
  VIENNA: "VIE", WIEN: "VIE",
  ISTANBUL: "IST",
  ANKARA: "ESB",
  ANTALYA: "AYT",
  MADRID: "MAD",
  BARCELONA: "BCN",
  MALAGA: "AGP",
  LISBON: "LIS", LISBOA: "LIS",
  PORTO: "OPO",
  ATHENS: "ATH",
  OSLO: "OSL",
  COPENHAGEN: "CPH",
  STOCKHOLM: "ARN",
  HELSINKI: "HEL",
  PRAGUE: "PRG",
  BUDAPEST: "BUD",
  WARSAW: "WAW",
  BUCHAREST: "OTP",
  BELGRADE: "BEG",
  ZAGREB: "ZAG",
  REYKJAVIK: "KEF",
  // Russia & CIS
  MOSCOW: "SVO",
  "SAINT PETERSBURG": "LED", "ST PETERSBURG": "LED",
  BAKU: "GYD",
  TBILISI: "TBS",
  YEREVAN: "EVN",
  TASHKENT: "TAS",
  ALMATY: "ALA",
  // Africa
  JOHANNESBURG: "JNB",
  "CAPE TOWN": "CPT", CAPETOWN: "CPT",
  CAIRO: "CAI",
  "ADDIS ABABA": "ADD", ADDISABABA: "ADD",
  NAIROBI: "NBO",
  LAGOS: "LOS",
  ACCRA: "ACC",
  CASABLANCA: "CMN",
  ALGIERS: "ALG",
  TUNIS: "TUN",
  MAURITIUS: "MRU",
  KAMPALA: "EBB",
  KIGALI: "KGL",
  DAKAR: "DSS",
  "DAR ES SALAAM": "DAR", DARESSALAAM: "DAR",
  // North America
  "NEW YORK": "JFK", NEWYORK: "JFK",
  "LOS ANGELES": "LAX", LOSANGELES: "LAX",
  "SAN FRANCISCO": "SFO", SANFRANCISCO: "SFO",
  CHICAGO: "ORD",
  ATLANTA: "ATL",
  DALLAS: "DFW",
  DENVER: "DEN",
  MIAMI: "MIA",
  SEATTLE: "SEA",
  BOSTON: "BOS",
  HOUSTON: "IAH",
  ORLANDO: "MCO",
  PHOENIX: "PHX",
  DETROIT: "DTW",
  MINNEAPOLIS: "MSP",
  CHARLOTTE: "CLT",
  PHILADELPHIA: "PHL",
  PORTLAND: "PDX",
  NASHVILLE: "BNA",
  AUSTIN: "AUS",
  TORONTO: "YYZ",
  VANCOUVER: "YVR",
  MONTREAL: "YUL",
  CALGARY: "YYC",
  // Latin America
  "MEXICO CITY": "MEX", MEXICOCITY: "MEX",
  CANCUN: "CUN",
  "SAO PAULO": "GRU", SAOPAULO: "GRU",
  "RIO DE JANEIRO": "GIG",
  "BUENOS AIRES": "EZE", BUENOSAIRES: "EZE",
  SANTIAGO: "SCL",
  LIMA: "LIM",
  BOGOTA: "BOG",
  MEDELLIN: "MDE",
  QUITO: "UIO",
  "PANAMA CITY": "PTY", PANAMACITY: "PTY",
  HAVANA: "HAV",
  "PUNTA CANA": "PUJ", PUNTACANA: "PUJ",
  // Oceania
  SYDNEY: "SYD",
  MELBOURNE: "MEL",
  BRISBANE: "BNE",
  PERTH: "PER",
  ADELAIDE: "ADL",
  AUCKLAND: "AKL",
  WELLINGTON: "WLG",
  QUEENSTOWN: "ZQN",
  FIJI: "NAN", NADI: "NAN",
  // Airport name keywords (OCR often picks up full airport names)
  "INDIRA GANDHI": "DEL", "IGI AIRPORT": "DEL",
  "CHHATRAPATI SHIVAJI": "BOM", "CSI AIRPORT": "BOM",
  KEMPEGOWDA: "BLR", "KIA AIRPORT": "BLR",
  "RAJIV GANDHI": "HYD", "SHAMSHABAD": "HYD",
  MEENAMBAKKAM: "MAA",
  DABOLIM: "GOI",
  "NETAJI SUBHAS": "CCU", "DUMDUM": "CCU",
  "SARDAR VALLABHBHAI": "AMD",
  LOHEGAON: "PNQ",
  SANGANER: "JAI",
  CHAUDHARY: "LKO",
  "CHANGI AIRPORT": "SIN", CHANGI: "SIN",
  SUVARNABHUMI: "BKK",
  HEATHROW: "LHR",
  GATWICK: "LGW",
  STANSTED: "STN",
  "CHARLES DE GAULLE": "CDG",
  SCHIPHOL: "AMS",
  FIUMICINO: "FCO",
  MALPENSA: "MXP",
  BARAJAS: "MAD",
  "EL PRAT": "BCN",
  ATATURK: "IST",
  "SABIHA GOKCEN": "SAW",
  INCHEON: "ICN",
  NARITA: "NRT",
  HANEDA: "HND",
  "JFK AIRPORT": "JFK", KENNEDY: "JFK",
  LAGUARDIA: "LGA",
  NEWARK: "EWR",
  "O HARE": "ORD", OHARE: "ORD",
  DULLES: "IAD",
  PEARSON: "YYZ",
  GUARULHOS: "GRU",
  GALEAO: "GIG",
  EZEIZA: "EZE",
  HAMAD: "DOH",
  "KING KHALID": "RUH",
  "KING ABDULAZIZ": "JED",
  SOEKARNO: "CGK",
  "NINOY AQUINO": "MNL",
  "KINGSFORD SMITH": "SYD",
  TULLAMARINE: "MEL",
  DAXING: "PKX",
  PUDONG: "PVG",
  HONGQIAO: "SHA",
  BAIYUN: "CAN",
  TAOYUAN: "TPE",
};

// ── Known Airlines ─────────────────────────────────────────────
const AIRLINE_LOOKUP: Record<string, string> = {
  AI: "Air India", "6E": "IndiGo", SG: "SpiceJet", UK: "Vistara",
  G8: "Go First", QP: "Akasa Air", IX: "Air India Express", I5: "AirAsia India",
  EK: "Emirates", EY: "Etihad Airways", QR: "Qatar Airways",
  SQ: "Singapore Airlines", BA: "British Airways", LH: "Lufthansa",
  AA: "American Airlines", DL: "Delta Air Lines", UA: "United Airlines",
  TG: "Thai Airways", MH: "Malaysia Airlines", CX: "Cathay Pacific",
  NH: "All Nippon Airways", JL: "Japan Airlines", KE: "Korean Air",
  TK: "Turkish Airlines", AF: "Air France", KL: "KLM Royal Dutch Airlines",
  LX: "Swiss International Air Lines", WY: "Oman Air", GF: "Gulf Air",
  UL: "SriLankan Airlines", RA: "Nepal Airlines", BG: "Biman Bangladesh Airlines",
  FZ: "flydubai", WG: "Sunwing Airlines", QF: "Qantas", NZ: "Air New Zealand",
  VA: "Virgin Australia", AC: "Air Canada", WS: "WestJet",
  IB: "Iberia", AZ: "ITA Airways", SK: "SAS Scandinavian Airlines",
  AY: "Finnair", TP: "TAP Air Portugal", EI: "Aer Lingus",
  OS: "Austrian Airlines", SN: "Brussels Airlines", LO: "LOT Polish Airlines",
  RO: "TAROM", PS: "Ukraine International Airlines",
  ET: "Ethiopian Airlines", KQ: "Kenya Airways", SA: "South African Airways",
  MS: "EgyptAir", AT: "Royal Air Maroc",
  AM: "Aeroméxico", AV: "Avianca", LA: "LATAM Airlines",
  CM: "Copa Airlines", JJ: "LATAM Brasil",
  CZ: "China Southern Airlines", CA: "Air China", MU: "China Eastern Airlines",
  HU: "Hainan Airlines", CI: "China Airlines", BR: "EVA Air",
  OZ: "Asiana Airlines", PR: "Philippine Airlines", VN: "Vietnam Airlines",
  AK: "AirAsia", FD: "Thai AirAsia", QZ: "Indonesia AirAsia",
  TR: "Scoot", "3K": "Jetstar Asia", "5J": "Cebu Pacific",
  WE: "Thai Smile", PG: "Bangkok Airways",
  W5: "Mahan Air", W6: "Wizz Air", FR: "Ryanair", U2: "easyJet",
  VY: "Vueling", PC: "Pegasus Airlines",
};

// ═══════════════════════════════════════════════════════════════════
//  Excluded words — common 3-letter English words that are NOT
//  airport codes. CAREFULLY cleaned to remove real IATA codes.
//
//  Removed from v2 exclusion list because they ARE real airports:
//  ACE(Lanzarote), ADD(Addis Ababa), IST(Istanbul), LED(St.Petersburg),
//  MAN(Manchester), OAK(Oakland), PEN(Penang), PER(Perth),
//  SAT(San Antonio), SAW(Istanbul), SUB(Surabaya), VAN(Van/Turkey)
// ═══════════════════════════════════════════════════════════════════
const EXCLUDED_WORDS = new Set([
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HAD",
  "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS",
  "HOW", "ITS", "MAY", "NEW", "NOW", "OLD", "SEE", "WAY", "WHO", "DID",
  "LET", "SAY", "SHE", "TOO", "USE", "MRS", "REF", "PNR", "ETD", "STD",
  "ETA", "STA", "ARR", "DEP", "FLT", "SEQ", "ROW", "BRD", "INR", "USD",
  "TAX", "FEE", "NET", "EST", "VIA", "AIR", "PAX", "YES", "AGE",
  "END", "FLY", "RUN", "SET", "TRY", "AGO", "AID", "AIM",
  "APR", "AUG", "AVG", "BAN", "BAR", "BED", "BIG", "BIT", "BOX", "BUS",
  "CAR", "CUT", "DOC", "DUE", "EAR", "EAT", "ERA", "EVE", "EYE", "FAN",
  "FAR", "FAX", "FIG", "FIN", "FIT", "FIX", "FUN", "GAP", "GAS", "GUN",
  "GYM", "HAT", "HIT", "HOT", "ICE", "ILL", "INK", "INN", "JOB", "JOY",
  "KEY", "KID", "LAP", "LAW", "LAY", "LEG", "LID", "LIE", "LIP",
  "LOG", "LOT", "LOW", "MAP", "MAT", "MID", "MIX", "MOD", "MUD", "NAP",
  "NOR", "NUT", "ODD", "OFF", "OIL", "OPT", "OWE", "OWN",
  "PAN", "PAD", "PAY", "PIE", "PIN", "PIT", "PLY",
  "POT", "PRO", "PUB", "PUR", "PUT", "RAN", "RAW", "RED", "RIB", "RID",
  "RIG", "RIM", "RIP", "ROD", "RUB", "RUG", "SAD", "SIT",
  "SIX", "SKI", "SKY", "SOP", "SOW", "SPY", "SUM", "SUN", "TAP",
  "TEA", "TEN", "TIE", "TIN", "TIP", "TOE", "TON", "TOP", "TOW", "TUB",
  "TWO", "VAT", "VET", "VOW", "WAR", "WEB", "WET", "WIG", "WIN",
  "WIT", "WOK", "WON", "WOO", "YEN", "YET", "ZAP", "ZEN", "ZIP", "ZOO",
  "NON", "NUM", "SEC", "MIN", "MAX", "AVE", "FRI", "MON", "TUE", "WED",
  "THU", "JAN", "FEB", "MAR", "JUN", "JUL", "OCT", "NOV",
  "DEC", "GMT",
]);

// ═══════════════════════════════════════════════════════════════════
//  HELPER: Check if a 3-letter code is a valid IATA candidate
//  - Must be exactly 3 uppercase letters
//  - Must NOT be in the exclusion list
//  - Known airport codes always pass
// ═══════════════════════════════════════════════════════════════════
function isValidIATACandidate(code: string): boolean {
  if (code.length !== 3 || !/^[A-Z]{3}$/.test(code)) return false;
  if (EXCLUDED_WORDS.has(code)) return false;
  return true;
}

function isKnownAirport(code: string): boolean {
  return !!AIRPORT_LOOKUP[code];
}

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
          pages: [1, 2, 3], // Scan first 3 pages
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
//  Text Normalization for OCR output (especially PDFs)
// ═══════════════════════════════════════════════════════════════════
function normalizeOCRText(raw: string): string {
  let t = raw;
  // Remove zero-width characters first
  t = t.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "");
  // Normalize Unicode arrows to ASCII arrow
  t = t.replace(/[\u2192\u2794\u27A1\u279C\u21D2\u2B95\u27A4]/g, "->");
  // Normalize dashes (en-dash, em-dash, horizontal bar, minus sign)
  t = t.replace(/[\u2013\u2014\u2015\u2212\u2010\u2011]/g, "-");
  // Normalize fancy quotes & apostrophes
  t = t.replace(/[\u2018\u2019\u201C\u201D\u00AB\u00BB]/g, "'");
  // Normalize various whitespace to single space (keep newlines)
  t = t.replace(/[^\S\n]+/g, " ");
  // Remove common OCR artifacts: vertical bars (often misread as I or l)
  t = t.replace(/\|/g, "I");
  // Fix OCR splitting: rejoin lines that break a keyword-value pair
  // e.g. "DEPARTURE\n DEL" → "DEPARTURE DEL"
  t = t.replace(/(FROM|TO|DEPARTURE|DEPART|DEP|ORIGIN|DESTINATION|DEST|ARRIVAL|ARRIVE|ARR|SECTOR|ROUTE|BOARDING AT|SOURCE|GATE|SEAT|FLIGHT|CLASS)\s*\n\s*/gi, "$1 ");
  // Collapse multiple newlines into single
  t = t.replace(/\n{3,}/g, "\n\n");
  // Trim each line
  t = t.split("\n").map((l: string) => l.trim()).filter(Boolean).join("\n");
  return t;
}

// ═══════════════════════════════════════════════════════════════════
//  Boarding Pass Text Parser v3 — Universal Airport Detection
//
//  KEY CHANGE from v2:
//   Detection does NOT require AIRPORT_LOOKUP membership!
//   Any 3-letter code not in EXCLUDED_WORDS is a candidate.
//   AIRPORT_LOOKUP is only used for name resolution & bonus scoring.
//
//  Strategy order:
//   1. Direct route patterns (DEL-BOM, DEL→BOM, DEL TO BOM)
//   2. Labeled fields (FROM: DEL, DEPARTURE: DEL, ARRIVAL: BOM)
//   3. City name → code resolution
//   4. Score-based proximity scan (all 3-letter candidates)
//   5. Code+city pair detection (DEL (DELHI))
//   6. Position-based fallback (first code = departure)
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
  // Normalize & uppercase
  const text = normalizeOCRText(rawText).toUpperCase();
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
  //  UNIVERSAL AIRPORT CODE EXTRACTION
  //  Does NOT require AIRPORT_LOOKUP membership for detection!
  // ═══════════════════════════════════════════════════════════

  const DEP_KEYWORDS = [
    "FROM", "ORIGIN", "DEPARTURE", "DEPART", "DEP", "DEPARTING",
    "BOARDING AT", "DEPARTS FROM", "SOURCE", "CITY OF DEPARTURE",
    "DEPARTING FROM", "SECTOR",
  ];
  const ARR_KEYWORDS = [
    "TO", "DESTINATION", "DEST", "ARRIVAL", "ARRIVE", "ARR", "ARRIVING",
    "ARRIVING AT", "GOING TO", "CITY OF ARRIVAL",
  ];

  interface CodeCandidate {
    code: string;
    depScore: number;
    arrScore: number;
    lineIndex: number;
    charIndex: number;
    isKnown: boolean; // bonus: code is in our AIRPORT_LOOKUP
  }

  const candidates: CodeCandidate[] = [];

  // ── Strategy 1: Direct route patterns (highest confidence) ──
  // These patterns are so specific that we trust them even for unknown codes
  const routePatterns = [
    // "DEL - BOM", "DEL -> BOM", "DEL – BOM", "DEL — BOM"
    /\b([A-Z]{3})\s*(?:->|[-–—])\s*([A-Z]{3})\b/,
    // "FROM DEL TO BOM"
    /\bFROM\s+([A-Z]{3})\s+TO\s+([A-Z]{3})\b/,
    // "DEL TO BOM" (with at least one known airport for safety)
    /\b([A-Z]{3})\s+TO\s+([A-Z]{3})\b/,
    // "DEL / BOM"
    /\b([A-Z]{3})\s*\/\s*([A-Z]{3})\b/,
    // "ORIGIN: DEL DESTINATION: BOM"
    /ORIGIN\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,80}DEST(?:INATION)?\s*[:\-]?\s*([A-Z]{3})/,
    // "DEP: DEL ARR: BOM"
    /DEP(?:ARTURE|ART)?\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,80}ARR(?:IVAL|IVE)?\s*[:\-]?\s*([A-Z]{3})/,
    // "DEPARTURE AIRPORT: DEL ... ARRIVAL AIRPORT: BOM"
    /DEPARTURE\s*(?:AIRPORT|STATION)?\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,120}ARRIVAL\s*(?:AIRPORT|STATION)?\s*[:\-]?\s*([A-Z]{3})/,
    // "SECTOR DEL BOM" or "SECTOR: DEL-BOM"
    /SECTOR\s*[:\-]?\s*([A-Z]{3})\s*[-\/\s]\s*([A-Z]{3})/,
    // "ROUTE: DEL BOM"
    /ROUTE\s*[:\-]?\s*([A-Z]{3})\s+([A-Z]{3})/,
    // "STN CODE: DEL ... STN CODE: BOM" (seen in some Indian boarding passes)
    /STN\s*(?:CODE)?\s*[:\-]?\s*([A-Z]{3})[\s\S]{0,100}STN\s*(?:CODE)?\s*[:\-]?\s*([A-Z]{3})/,
    // "[DEL] ... [BOM]" (bracketed codes)
    /\[([A-Z]{3})\][\s\S]{0,100}\[([A-Z]{3})\]/,
    // Flight route in format "AI 839 DEL BOM" (airline + flight + codes)
    /\b[A-Z0-9]{2}\s*\d{3,4}\s+([A-Z]{3})\s+([A-Z]{3})\b/,
  ];

  let routeFound = false;
  for (const pattern of routePatterns) {
    const m = text.match(pattern);
    if (m && m[1] && m[2]) {
      const code1 = m[1];
      const code2 = m[2];
      const code1Valid = isValidIATACandidate(code1);
      const code2Valid = isValidIATACandidate(code2);

      if (code1Valid && code2Valid) {
        // For "X TO Y" pattern (3rd pattern), require at least one known airport
        // to avoid false positives from common phrases
        if (pattern.source.includes("\\s+TO\\s+") && !pattern.source.includes("FROM")) {
          if (!isKnownAirport(code1) && !isKnownAirport(code2)) continue;
        }

        result.departure_airport_code = code1;
        result.arrival_airport_code = code2;
        routeFound = true;
        console.log(`[parser] Route pattern matched: ${code1} -> ${code2}`);
        break;
      }
    }
  }

  // ── Strategy 2: Labeled fields (FROM: DEL, DEPARTURE: BLR) ──
  // Now scans both within lines AND across adjacent lines for PDF support
  if (!routeFound) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // Build a multi-line context: current + next 2 lines (PDFs often split fields)
      const mlContext = [
        line,
        li + 1 < lines.length ? lines[li + 1] : "",
        li + 2 < lines.length ? lines[li + 2] : "",
      ].join(" ");

      // Check for departure keywords followed by a code
      if (!result.departure_airport_code) {
        for (const kw of DEP_KEYWORDS) {
          if (kw === "TO") continue; // Skip "TO" for departure
          const depRegex = new RegExp(
            `\\b${kw}\\s*[:\\-]?\\s*([A-Z]{3})\\b`
          );
          // Try on single line first (more precise)
          let dm = line.match(depRegex);
          if (!dm) dm = mlContext.match(depRegex); // Then multi-line
          if (dm && isValidIATACandidate(dm[1])) {
            result.departure_airport_code = dm[1];
            console.log(`[parser] Labeled departure: ${kw} -> ${dm[1]}`);
            break;
          }
        }
      }
      // Check for arrival keywords followed by a code
      if (!result.arrival_airport_code) {
        for (const kw of ARR_KEYWORDS) {
          if (kw === "TO") {
            // "TO" requires colon/dash to avoid false positives
            const toRegex = /\bTO\s*[:\-]\s*([A-Z]{3})\b/;
            let tm = line.match(toRegex);
            if (!tm) tm = mlContext.match(toRegex);
            if (tm && isValidIATACandidate(tm[1])) {
              result.arrival_airport_code = tm[1];
              console.log(`[parser] Labeled arrival: TO -> ${tm[1]}`);
              break;
            }
          } else {
            const arrRegex = new RegExp(
              `\\b${kw}\\s*[:\\-]?\\s*([A-Z]{3})\\b`
            );
            let am = line.match(arrRegex);
            if (!am) am = mlContext.match(arrRegex);
            if (am && isValidIATACandidate(am[1])) {
              result.arrival_airport_code = am[1];
              console.log(`[parser] Labeled arrival: ${kw} -> ${am[1]}`);
              break;
            }
          }
        }
      }
    }
  }

  // ── Strategy 3: City name → code resolution ──
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    const foundCities: {
      city: string;
      code: string;
      index: number;
      depScore: number;
      arrScore: number;
    }[] = [];

    // Sort city names by length descending so longer names match first
    const sortedCities = Object.entries(CITY_TO_CODE).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [city, code] of sortedCities) {
      const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const cityRegex = new RegExp(`\\b${escaped}\\b`, "g");
      let cm;
      while ((cm = cityRegex.exec(text)) !== null) {
        const surroundStart = Math.max(0, cm.index - 80);
        const surroundEnd = Math.min(text.length, cm.index + city.length + 80);
        const surrounding = text.substring(surroundStart, surroundEnd);

        let depScore = 0;
        let arrScore = 0;

        for (const kw of DEP_KEYWORDS) {
          if (kw !== "TO" && surrounding.includes(kw)) depScore += 3;
        }
        for (const kw of ARR_KEYWORDS) {
          if (kw !== "TO" && surrounding.includes(kw)) arrScore += 3;
        }

        foundCities.push({ city, code, index: cm.index, depScore, arrScore });
      }
    }

    if (foundCities.length >= 2) {
      // Deduplicate by code (keep first occurrence = earlier in text)
      const seenCodes = new Set<string>();
      const uniqueCities = foundCities.filter((c) => {
        if (seenCodes.has(c.code)) return false;
        seenCodes.add(c.code);
        return true;
      });

      // Sort by position in text
      uniqueCities.sort((a, b) => a.index - b.index);

      // Use scores if clear, otherwise position-based
      const depCity =
        uniqueCities.find((c) => c.depScore > c.arrScore) || uniqueCities[0];

      const arrCity =
        uniqueCities.find(
          (c) => c.code !== depCity.code && c.arrScore > c.depScore
        ) || uniqueCities.find((c) => c.code !== depCity.code);

      if (!result.departure_airport_code && depCity) {
        result.departure_airport_code = depCity.code;
        console.log(
          `[parser] City departure: ${depCity.city} -> ${depCity.code}`
        );
      }
      if (
        !result.arrival_airport_code &&
        arrCity &&
        arrCity.code !== result.departure_airport_code
      ) {
        result.arrival_airport_code = arrCity.code;
        console.log(
          `[parser] City arrival: ${arrCity.city} -> ${arrCity.code}`
        );
      }
    } else if (foundCities.length === 1 && !result.departure_airport_code) {
      result.departure_airport_code = foundCities[0].code;
      console.log(
        `[parser] City (single): ${foundCities[0].city} -> ${foundCities[0].code}`
      );
    }
  }

  // ── Strategy 4: Score-based 3-letter code proximity scan ──
  // KEY CHANGE: No longer requires AIRPORT_LOOKUP membership!
  // Any valid 3-letter code (not excluded) is a candidate.
  // Known airports get a bonus score.
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const codeRegex = /\b([A-Z]{3})\b/g;
      let cm;
      while ((cm = codeRegex.exec(line)) !== null) {
        const code = cm[1];

        // Basic filtering: must be valid candidate
        if (!isValidIATACandidate(code)) continue;

        // Skip if it looks like a month abbreviation in a date context
        const monthAbbr = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
        if (monthAbbr.includes(code)) continue;

        // Build wider context from adjacent lines (5-line window for PDF support)
        const contextLines = [
          li > 1 ? lines[li - 2] : "",
          li > 0 ? lines[li - 1] : "",
          line,
          li < lines.length - 1 ? lines[li + 1] : "",
          li < lines.length - 2 ? lines[li + 2] : "",
        ].join(" ");

        let depScore = 0;
        let arrScore = 0;

        // Score based on proximity to keywords
        for (const kw of DEP_KEYWORDS) {
          if (kw !== "TO" && contextLines.includes(kw)) depScore += 2;
        }
        for (const kw of ARR_KEYWORDS) {
          if (kw !== "TO" && contextLines.includes(kw)) arrScore += 2;
        }

        // Bonus: near TERMINAL, GATE, CHECK-IN → likely departure airport
        if (
          contextLines.includes("TERMINAL") ||
          contextLines.includes("GATE") ||
          contextLines.includes("CHECK")
        ) {
          depScore += 1;
        }

        // Bonus: known airport code → higher confidence
        const known = isKnownAirport(code);
        if (known) {
          depScore += 3;
          arrScore += 3;
        }

        // For unknown codes, require some contextual signal
        if (!known && depScore === 0 && arrScore === 0) {
          // Check if this code appears near aviation-related context
          const aviationContext =
            contextLines.includes("FLIGHT") ||
            contextLines.includes("BOARDING") ||
            contextLines.includes("AIRPORT") ||
            contextLines.includes("AIRLINE") ||
            contextLines.includes("PASSENGER") ||
            contextLines.includes("SEAT") ||
            contextLines.includes("TERMINAL") ||
            contextLines.includes("GATE") ||
            contextLines.includes("PNR") ||
            contextLines.includes("TICKET") ||
            contextLines.includes("BOARDING PASS") ||
            contextLines.includes("E-TICKET") ||
            contextLines.includes("CHECK-IN") ||
            contextLines.includes("ITINERARY") ||
            contextLines.includes("SECTOR") ||
            contextLines.includes("ROUTE");
          if (!aviationContext) continue; // Skip if no aviation context at all
          depScore += 1;
          arrScore += 1;
        }

        candidates.push({
          code,
          depScore,
          arrScore,
          lineIndex: li,
          charIndex: cm.index,
          isKnown: known,
        });
      }
    }

    if (candidates.length > 0) {
      // Deduplicate: keep highest scored instance per code
      const uniqueCodes = new Map<string, CodeCandidate>();
      for (const c of candidates) {
        const existing = uniqueCodes.get(c.code);
        if (
          !existing ||
          c.depScore + c.arrScore > existing.depScore + existing.arrScore
        ) {
          uniqueCodes.set(c.code, c);
        }
      }

      const sortedCandidates = Array.from(uniqueCodes.values());

      if (!result.departure_airport_code) {
        // Pick highest departure score, prefer known airports, then earliest position
        const depCandidate = sortedCandidates.reduce((best, c) => {
          if (c.depScore > best.depScore) return c;
          if (c.depScore === best.depScore) {
            if (c.isKnown && !best.isKnown) return c;
            if (c.lineIndex < best.lineIndex) return c;
          }
          return best;
        });
        result.departure_airport_code = depCandidate.code;
        console.log(
          `[parser] Scored departure: ${depCandidate.code} (score=${depCandidate.depScore}, known=${depCandidate.isKnown})`
        );

        if (!result.arrival_airport_code) {
          const arrCandidates = sortedCandidates.filter(
            (c) => c.code !== depCandidate.code
          );
          if (arrCandidates.length > 0) {
            const arrCandidate = arrCandidates.reduce((best, c) => {
              if (c.arrScore > best.arrScore) return c;
              if (c.arrScore === best.arrScore) {
                if (c.isKnown && !best.isKnown) return c;
                if (c.lineIndex > best.lineIndex) return c; // arrival usually after departure
              }
              return best;
            });
            result.arrival_airport_code = arrCandidate.code;
            console.log(
              `[parser] Scored arrival: ${arrCandidate.code} (score=${arrCandidate.arrScore}, known=${arrCandidate.isKnown})`
            );
          }
        }
      } else if (!result.arrival_airport_code) {
        const arrCandidates = sortedCandidates.filter(
          (c) => c.code !== result.departure_airport_code
        );
        if (arrCandidates.length > 0) {
          const arrCandidate = arrCandidates.reduce((best, c) =>
            c.arrScore > best.arrScore ? c : best
          );
          result.arrival_airport_code = arrCandidate.code;
        }
      }
    }
  }

  // ── Strategy 5: Code + city name together ──
  // e.g., "DEL (DELHI)" or "DELHI (DEL)" or "[DEL]"
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    const pairPattern =
      /\b([A-Z]{3})\s*[\(\[]\s*([A-Z][A-Z\s]+)\s*[\)\]]|\b([A-Z][A-Z\s]+)\s*[\(\[]\s*([A-Z]{3})\s*[\)\]]/g;
    let pcm;
    const pairCodes: string[] = [];
    while ((pcm = pairPattern.exec(text)) !== null) {
      const code = pcm[1] || pcm[4];
      if (code && isValidIATACandidate(code)) {
        pairCodes.push(code);
      }
    }
    if (!result.departure_airport_code && pairCodes.length >= 1) {
      result.departure_airport_code = pairCodes[0];
      console.log(`[parser] Pair departure: ${pairCodes[0]}`);
    }
    if (!result.arrival_airport_code && pairCodes.length >= 2) {
      result.arrival_airport_code = pairCodes[1];
      console.log(`[parser] Pair arrival: ${pairCodes[1]}`);
    }
  }

  // ── Strategy 6: Position-based fallback ──
  // If we still haven't found both, scan ALL valid 3-letter codes
  // and use position: first = departure, second = arrival
  if (!result.departure_airport_code || !result.arrival_airport_code) {
    const allCodes: { code: string; index: number }[] = [];
    const globalCodeRegex = /\b([A-Z]{3})\b/g;
    let gcm;
    while ((gcm = globalCodeRegex.exec(text)) !== null) {
      const code = gcm[1];
      if (!isValidIATACandidate(code)) continue;
      // Prefer known airports; for unknown codes, check nearby aviation context
      if (isKnownAirport(code)) {
        allCodes.push({ code, index: gcm.index });
      } else {
        // Check if surrounding text has aviation keywords
        const start = Math.max(0, gcm.index - 120);
        const end = Math.min(text.length, gcm.index + 120);
        const nearby = text.substring(start, end);
        const hasContext =
          nearby.includes("FLIGHT") || nearby.includes("BOARDING") ||
          nearby.includes("AIRPORT") || nearby.includes("PASSENGER") ||
          nearby.includes("SEAT") || nearby.includes("GATE") ||
          nearby.includes("TERMINAL") || nearby.includes("PNR") ||
          nearby.includes("DEPARTURE") || nearby.includes("ARRIVAL") ||
          nearby.includes("TICKET") || nearby.includes("SECTOR");
        if (hasContext) {
          allCodes.push({ code, index: gcm.index });
        }
      }
    }

    // Deduplicate (keep first occurrence of each code)
    const seen = new Set<string>();
    const uniquePositionCodes = allCodes.filter((c) => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });

    if (!result.departure_airport_code && uniquePositionCodes.length >= 1) {
      result.departure_airport_code = uniquePositionCodes[0].code;
      console.log(
        `[parser] Position fallback departure: ${uniquePositionCodes[0].code}`
      );
    }
    if (
      !result.arrival_airport_code &&
      uniquePositionCodes.length >= 2 &&
      uniquePositionCodes[1].code !== result.departure_airport_code
    ) {
      result.arrival_airport_code = uniquePositionCodes[1].code;
      console.log(
        `[parser] Position fallback arrival: ${uniquePositionCodes[1].code}`
      );
    }
  }

  // ── Resolve airport names ──
  // For known airports, use the lookup. For unknown codes, show generic name.
  if (result.departure_airport_code) {
    result.departure_airport_name =
      AIRPORT_LOOKUP[result.departure_airport_code] ||
      `Airport ${result.departure_airport_code}`;
  }
  if (result.arrival_airport_code) {
    result.arrival_airport_name =
      AIRPORT_LOOKUP[result.arrival_airport_code] ||
      `Airport ${result.arrival_airport_code}`;
  }

  console.log(
    `[parser] Final airports: DEP=${result.departure_airport_code} (${result.departure_airport_name}), ARR=${result.arrival_airport_code} (${result.arrival_airport_name})`
  );

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
    const slashName = text.match(
      /\b([A-Z]{2,20})\/([A-Z]{2,20}(?:\s+[A-Z]+)?)\b/
    );
    if (slashName) {
      result.passenger_name = slashName[2] + " " + slashName[1];
    }
  }

  // ── Seat ──────────────────────────────────────────────────
  const seatMatch = text.match(
    /(?:SEAT|ST|SEAT\s*NO)\s*[:\-]?\s*(\d{1,2}[A-F])\b/
  );
  if (seatMatch) {
    result.seat = seatMatch[1];
  } else {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("SEAT")) {
        const seatInLine = lines[i].match(/\b(\d{1,2}[A-F])\b/);
        if (seatInLine) {
          result.seat = seatInLine[1];
          break;
        }
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
  const boardTimeMatch = text.match(
    /BOARD(?:ING)?\s*(?:TIME)?\s*[:\-]?\s*(\d{2})[:\.](\d{2})/
  );
  if (boardTimeMatch) {
    result.boarding_time = boardTimeMatch[1] + ":" + boardTimeMatch[2];
  }
  const depTimeMatch = text.match(
    /(?:DEPART(?:URE)?|DEP|ETD|STD)\s*(?:TIME)?\s*[:\-]?\s*(\d{2})[:\.](\d{2})/
  );
  if (depTimeMatch) {
    result.departure_time = depTimeMatch[1] + ":" + depTimeMatch[2];
  }

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
  const seqMatch = text.match(
    /(?:SEQ(?:UENCE)?|BOARDING\s*(?:NO|NUM|#))\s*[:\-]?\s*(\d{1,4})/
  );
  if (seqMatch) {
    result.sequence_number = seqMatch[1];
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
//  Gemini Vision — Direct multimodal parsing (PRIMARY)
//
//  Sends the raw image/PDF directly to Gemini 2.0 Flash.
//  Gemini reads it visually and extracts structured data.
//  Single API call → much faster than OCR + text parsing.
// ═══════════════════════════════════════════════════════════════════

const GEMINI_PROMPT = `You are an expert boarding pass and e-ticket parser. Look at this boarding pass image/document and extract ALL available information.

Return ONLY a valid JSON object (no markdown fences, no explanation) with these exact keys. Use null for any field you cannot confidently determine.

{
  "passenger_name": "Full name (First Last format)",
  "flight_number": "Airline code + number, e.g. AI 839, 6E 2341",
  "airline": "Full airline name, e.g. Air India, IndiGo",
  "departure_airport_code": "3-letter IATA code, e.g. DEL",
  "departure_airport_name": "Full airport name with city",
  "arrival_airport_code": "3-letter IATA code, e.g. BOM",
  "arrival_airport_name": "Full airport name with city",
  "departure_date": "YYYY-MM-DD format",
  "departure_time": "HH:MM 24-hour format",
  "boarding_time": "HH:MM 24-hour format",
  "gate": "Gate number/letter",
  "seat": "e.g. 12A",
  "booking_reference": "PNR / confirmation code",
  "travel_class": "Economy / Business / First / Premium Economy",
  "sequence_number": "Boarding sequence number"
}

CRITICAL RULES:
1. For airport codes — ALWAYS use official IATA 3-letter codes. If you see a city name (e.g. Delhi, Mumbai, New York), map it to the correct IATA code (DEL, BOM, JFK).
2. For dates — convert to YYYY-MM-DD regardless of input format.
3. For names in LASTNAME/FIRSTNAME format, convert to "Firstname Lastname".
4. For airline codes (AI, 6E, SG, UK, EK, etc.), expand to full airline name.
5. Be aggressive about extraction — boarding passes can have unusual layouts.
6. If there are multiple flights (connecting), extract only the FIRST segment.`;

async function parseWithGeminiVision(
  base64Content: string,
  isPdf: boolean
): Promise<{ parsed: ParsedBoardingPass; rawText: string } | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[Gemini] No GEMINI_API_KEY secret set");
    return null;
  }

  const cleanBase64 = base64Content.replace(/^data:[^;]+;base64,/, "");
  const mimeType = isPdf ? "application/pdf" : "image/jpeg";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GEMINI_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[Gemini] API error:", res.status, errBody.substring(0, 400));
      return null;
    }

    const data = await res.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("[Gemini] Empty response from model");
      return null;
    }

    console.log("[Gemini] Raw response:", responseText.substring(0, 500));

    // Parse JSON
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const p = JSON.parse(jsonStr);

    const result: ParsedBoardingPass = {
      passenger_name: typeof p.passenger_name === "string" ? p.passenger_name : null,
      flight_number: typeof p.flight_number === "string" ? p.flight_number : null,
      airline: typeof p.airline === "string" ? p.airline : null,
      departure_airport_code: null,
      departure_airport_name: typeof p.departure_airport_name === "string" ? p.departure_airport_name : null,
      arrival_airport_code: null,
      arrival_airport_name: typeof p.arrival_airport_name === "string" ? p.arrival_airport_name : null,
      departure_date: typeof p.departure_date === "string" ? p.departure_date : null,
      departure_time: typeof p.departure_time === "string" ? p.departure_time : null,
      boarding_time: typeof p.boarding_time === "string" ? p.boarding_time : null,
      gate: typeof p.gate === "string" ? p.gate : null,
      seat: typeof p.seat === "string" ? p.seat : null,
      booking_reference: typeof p.booking_reference === "string" ? p.booking_reference : null,
      travel_class: typeof p.travel_class === "string" ? p.travel_class : null,
      sequence_number: p.sequence_number != null ? String(p.sequence_number) : null,
    };

    // Validate airport codes
    if (typeof p.departure_airport_code === "string" && /^[A-Z]{3}$/i.test(p.departure_airport_code)) {
      result.departure_airport_code = p.departure_airport_code.toUpperCase();
    }
    if (typeof p.arrival_airport_code === "string" && /^[A-Z]{3}$/i.test(p.arrival_airport_code)) {
      result.arrival_airport_code = p.arrival_airport_code.toUpperCase();
    }

    // Enrich names from lookup if Gemini didn't provide them
    if (result.departure_airport_code && !result.departure_airport_name) {
      result.departure_airport_name = AIRPORT_LOOKUP[result.departure_airport_code] || `Airport ${result.departure_airport_code}`;
    }
    if (result.arrival_airport_code && !result.arrival_airport_name) {
      result.arrival_airport_name = AIRPORT_LOOKUP[result.arrival_airport_code] || `Airport ${result.arrival_airport_code}`;
    }

    console.log(`[Gemini] ✓ DEP=${result.departure_airport_code} (${result.departure_airport_name}), ARR=${result.arrival_airport_code} (${result.arrival_airport_name}), Flight=${result.flight_number}`);

    return { parsed: result, rawText: responseText };
  } catch (err: any) {
    console.error("[Gemini] Error:", err.message);
    return null;
  }
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
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const body = await req.json();
  const { image_base64, pdf_base64 } = body;
  const isPdf = !!pdf_base64;
  const content = pdf_base64 || image_base64;

  if (!content) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "image_base64 or pdf_base64 is required",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // ===== PRIMARY: Send raw image/PDF directly to Gemini Vision =====
    // Single API call — Gemini reads the document visually, no OCR needed
    console.log("[scan] Sending", isPdf ? "PDF" : "image", "directly to Gemini Vision...");
    const geminiResult = await parseWithGeminiVision(content, isPdf);

    let parsed: ParsedBoardingPass;
    let rawText = "";
    let confidence = 0.9;

    if (geminiResult && (geminiResult.parsed.departure_airport_code || geminiResult.parsed.arrival_airport_code)) {
      parsed = geminiResult.parsed;
      rawText = geminiResult.rawText;
      console.log("[scan] ✓ Gemini Vision successfully parsed boarding pass");
    } else {
      // ===== FALLBACK: Vision OCR + regex parser =====
      console.log("[scan] Gemini unavailable — falling back to Vision OCR + regex...");
      const ocrResult = await callVisionOCR(content, isPdf);
      rawText = ocrResult.text;
      confidence = ocrResult.confidence;

      if (!rawText) {
        return new Response(
          JSON.stringify({
            success: false,
            error: isPdf
              ? "Could not extract text from PDF. Please try a clearer file."
              : "Could not extract text from image. Please try a clearer photo.",
          }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("[scan] OCR text length:", rawText.length);
      parsed = parseBoardingPassText(rawText);
    }

    console.log("[scan] Final parsed:", JSON.stringify(parsed));

    // Upload file to Supabase Storage
    const supabase = getSupabaseClient(authHeader);
    const cleanBase64 = content.replace(/^data:[^;]+;base64,/, "");
    const fileBytes = Uint8Array.from(atob(cleanBase64), (c) =>
      c.charCodeAt(0)
    );
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

    // Insert into DB
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
      return new Response(
        JSON.stringify({
          success: true,
          boarding_pass: { ...parsed, extraction_confidence: confidence },
          warning: "Data extracted but could not save to database",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        boarding_pass: insertedData,
        message: "Boarding pass scanned successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[scan] Error:", err.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "OCR processing failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const id = url.searchParams.get("id");

  const supabase = getSupabaseClient(authHeader);

  try {
    if (id) {
      const { data, error } = await supabase
        .from("boarding_passes")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Boarding pass not found",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, boarding_pass: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "latest") {
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
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, boarding_pass: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Default: list all
    const { data, error } = await supabase
      .from("boarding_passes")
      .select(
        "id, passenger_name, flight_number, airline, departure_airport_code, arrival_airport_code, departure_date, departure_time, seat, gate, travel_class, status, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        boarding_passes: data || [],
        count: (data || []).length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[get] Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Main Server
// ═══════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
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
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[server] Unhandled error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
