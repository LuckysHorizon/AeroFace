AeroFace
UI / UX Design Specification

Version 1.0

1. Design Philosophy
Core Principles

Minimal

High trust

Premium aviation feel

Clear hierarchy

Strong spacing system

Accessible

Modular components

No decorative clutter

AeroFace UI should feel similar to:

Stripe Dashboard

Linear

Notion

Modern airport digital kiosks

2. Design System
2.1 Color System
Primary Brand Colors
Usage	Color	Hex
Primary	Deep Navy	#0B1F33
Accent	Aviation Blue	#1E3A8A
Success	Emerald	#10B981
Warning	Amber	#F59E0B
Danger	Red	#EF4444
Background	Off White	#F8FAFC
Card	Pure White	#FFFFFF
Border	Neutral Gray	#E5E7EB

Dark mode variant:

Background: #0F172A

Card: #1E293B

2.2 Typography

Font Family:

Inter

System fallback

Hierarchy:

Type	Size	Weight
H1	32px	600
H2	24px	600
H3	20px	500
Body	16px	400
Small	14px	400

Line height: 1.6
Letter spacing: Normal

2.3 Spacing System

Use 4px scale:

4

8

12

16

24

32

48

64

Cards must always use:

Padding: 24px

Border radius: 16px

Shadow: soft-sm

3. UI Architecture
3.1 Application Layout
Auth Layout
Centered card
Max width: 420px
Full height screen
Soft background gradient
App Layout (Logged In)
Sidebar (fixed)
Top Navigation Bar
Content Area
4. Component Library Structure (Next.js + shadcn)
frontend/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── AppLayout.tsx
│   │
│   ├── ui/                 # shadcn components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Dialog.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Badge.tsx
│   │   ├── Table.tsx
│   │   └── Tabs.tsx
│   │
│   ├── booking/
│   ├── boarding/
│   ├── face/
│   ├── admin/
│   └── charts/

No business logic inside UI components.

5. Core Screens Design
5.1 Authentication Screens
Login

Structure:

Logo (centered)

Heading: “Sign in to AeroFace”

Email input

Password input

Primary Button (Full width)

Secondary link

shadcn Components:

Card

Input

Button

Icons:

Mail (lucide)

Lock

5.2 Passenger Dashboard

Layout:

Left Sidebar:

Dashboard

Lounges

My Bookings

Face Registration

Settings

Topbar:

Airport indicator

User dropdown

Notification bell

Main Content:

Welcome heading

Flight summary card

Active booking card

Quick actions

5.3 Boarding Pass Upload Screen

Clean Card Layout

Card Title:
“Verify Your Flight”

Inside:

Drag & Drop Upload area

File preview

Parsed details preview

Use:

Card

Separator

Badge (for airline code)

Skeleton loader during parsing

Flight Details Card:

Field	Value
Airline	Indigo
Flight	6E 626
From	VNS
To	HYD
Date	19 Feb

Primary Button:
“Continue to Lounge Selection”

5.4 Lounge Selection Screen

Grid Layout:

3-column responsive cards

Each card contains:

Lounge Name

Terminal

Amenities icons

Price

Select button

Use:

Card

Badge

Button

Lucide icons (Wifi, Coffee, Briefcase, Utensils)

Selected state:

Blue border

Slight elevation

Accent highlight

5.5 Booking Confirmation Screen

Centered confirmation card:

Booking ID

Validity time

QR summary

Proceed to Face Registration button

5.6 Face Registration Screen

Structure:

Large camera preview container

Below:

Step indicator (Capture → Liveness → Confirm)

Status badge

Retry button

Design:

Dark background container
Subtle blue border
Minimal UI

No decorative elements.

5.7 Admin CRM Dashboard

Grid Layout:

Top:

Revenue Card

Active Guests Card

Occupancy Card

Failed Attempts Card

Below:

Entry Logs Table

Analytics Chart (Recharts)

Use:

Card

Table

Tabs

Bar Chart

Line Chart

Icons:

Users

DollarSign

Activity

Shield

6. Icon System

Use:

Lucide Icons

Examples:

Plane

ScanLine

ShieldCheck

CreditCard

User

Settings

Users

Activity

Icons must:

Be 18px or 20px

Have consistent stroke width

Never overuse

7. Component Standards

Buttons:

Primary:

bg-blue-600

hover:bg-blue-700

text-white

rounded-xl

Secondary:

bg-white

border

hover:bg-gray-50

Cards:

bg-white

rounded-2xl

shadow-sm

border-gray-200

No heavy shadows.

8. State Design

Loading:

Skeleton components

Subtle animation

Success:

Green badge

Clear message

Error:

Red border on input

Clean message below input

Never show raw backend errors.

9. Accessibility

All buttons accessible

ARIA labels for icons

Proper tab navigation

High contrast text

Keyboard navigation

10. Responsive Design

Breakpoints:

Mobile

Tablet

Desktop

Sidebar collapses on mobile.
Cards stack vertically.

11. Motion & Interaction

Use minimal motion:

Framer Motion

Fade transitions

Slide in modals

Subtle hover states

No flashy animations.

12. Design Consistency Rules

Max 3 colors per screen

Always use spacing system

Never mix border radius sizes randomly

No inline styles

Use Tailwind classes

All buttons same height

13. UI Quality Checklist

Before merge:

Alignment checked

Spacing consistent

No console errors

No hardcoded colors

No inline CSS

Reusable components only

Clean props typing

14. Folder Structure (Frontend Clean)
frontend/
├── app/
├── components/
├── lib/
├── hooks/
├── types/
├── styles/
├── config/
└── utils/

No API logic in components.

15. Final UI Feel

AeroFace should feel:

Premium

Calm

Secure

Airport-grade

Enterprise

Clean

Trustworthy

Not startup flashy.
Not colorful.
Not cluttered.

And Completely Mobile Responsive.