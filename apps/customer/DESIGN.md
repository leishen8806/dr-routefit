---
version: alpha
colors:
  navy: "#0B2545"
  teal: "#13C29B"
  orange: "#F5A623"
  background: "#F3F5F7"
  surface: "#FFFFFF"
  textSecondary: "#59697A"
  line: "#D9E1E8"
typography:
  khmer:
    fontFamily: "Noto Sans Khmer, sans-serif"
    fontSize: "16px"
    lineHeight: "1.85"
  latin:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "16px"
    lineHeight: "1.55"
  chinese:
    fontFamily: "Noto Sans SC, sans-serif"
    fontSize: "16px"
    lineHeight: "1.7"
rounded:
  control: "8px"
  card: "16px"
spacing:
  unit: "4px"
  content: "24px"
components:
  tab:
    minHeight: "56px"
  languageSwitch:
    minHeight: "44px"
---

## Overview

The customer surface is a calm delivery counter for Cambodian senders and recipients: the route line is the signature, while every interaction stays quiet, readable and trustworthy. It is a product interface, not a marketing page. Avoid dashboard density, decorative gradients and data that the service has not supplied.

## Colors

Use the repository RouteFit palette. Navy carries hierarchy, teal marks the active route or control, orange is a restrained cargo accent, and neutral surfaces keep Khmer script readable. Telegram theme colors may replace page and text surfaces at runtime, but must not change semantic hierarchy.

## Typography

Khmer is the first-run language and receives the most generous line height. Never tighten Khmer tracking or force it into a fixed single line. English, Chinese and Khmer use repository-installed, self-hosted font packages; no runtime font request is sent to Google Fonts or another font CDN.

## Layout

Phone layouts use one centered content column and a full-width bottom tab bar. Wide layouts keep the same four bottom destinations within a restrained desktop frame rather than inventing a second navigation model. Content must remain usable at 390 px and 1440 px.

## Elevation & Depth

Static surfaces use borders rather than shadows. The selected tab is indicated by text, weight and a route-line marker, not color alone.

## Shapes

Controls use 8 px radii; large content panels use 16 px. The route line may use fully rounded ends as the only pill-like signature.

## Components

Language controls use native-language labels and visible focus. Tabs use tab semantics, expose selection state, and keep a minimum 56 px touch target. Empty states explain that the feature is not yet open; they do not imply data exists.

## Do's and Don'ts

- Do keep Khmer copy visible without clipping and mark it as awaiting native review.
- Do expose Telegram versus H5 mode only in development builds.
- Do not load business data, Telegram identity fields or customer details in this skeleton.
- Do not present web-only placeholders as native background location, camera, push or offline support.
