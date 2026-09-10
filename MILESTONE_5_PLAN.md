# Milestone 5 Plan — GPS-Only Property Identification

**Status:** NEXT
**Target:** Finish automatic property identity before exposing prior property/community intelligence

## Goal

A user should not have to type or replace the property address. Sweeper should derive the best available property identity from a fresh precise device location, explain its confidence, and use the same identity consistently for repeat sweeps.

## Existing foundation

Already implemented before M5:

- When-In-Use location permission
- no background-location requirement
- fresh high-accuracy GPS request
- automatic retry after permission flow
- 50 m maximum-accuracy gate
- latitude/longitude/accuracy capture
- native reverse geocoder dependency
- locality/administrative-area/country display
- manual address fields removed from the active location UI
- backend `properties` table
- backend nearby-property endpoint
- property scan/report history endpoint

## Required M5 work

### 1. Native street-level reverse geocoding

Capture the most specific native-geocoder fields available on both iOS and Android, including where available:

- street number
- street/route
- sublocality/neighborhood
- locality/city
- administrative area/state
- postal code
- country
- ISO country code

Do not fail the sweep merely because a street-level field is absent. GPS coordinates remain authoritative.

### 2. Normalized property identity

Create one normalized property-identity object in shared TypeScript rather than passing loose `name`/`address` strings.

It should retain:

- lat/lng
- GPS accuracy
- formatted native address when available
- normalized street address components
- locality/region/postal/country
- identity source (`street_address`, `coordinate_fallback`, later possibly `matched_property`)
- confidence/explanation

### 3. Coordinate fallback

If reverse geocoding cannot return a usable street address, create a deterministic coordinate-based identity rather than asking the user to type one.

The fallback must be stable enough for later property matching without pretending that a coordinate bucket is a precise postal address.

### 4. Property matching tolerance

Before creating a new property record, compare the current GPS result with existing nearby properties.

Matching should consider:

- normalized address equality/compatibility when a native street address exists
- physical distance between coordinates
- current GPS accuracy
- a conservative maximum matching radius

Do not merge two nearby hotel/rental properties merely because both points fall into the same coarse coordinate bucket.

### 5. Backend property-key update

The current backend property key hashes submitted address/fallback text plus coordinates rounded to four decimal places. That is a foundation, not the final M5 identity algorithm.

M5 should introduce explicit normalized identity fields/matching logic and preserve backward compatibility with development data where practical.

A migration/versioning strategy can remain lightweight for the MVP, but the matching rule must be explicit and documented.

### 6. Location UI

The user should see:

- GPS acquired / accuracy
- resolved property/address or coordinate fallback
- a clear note that the property came from device location
- retry/refresh GPS

The user should **not** be able to substitute a manually typed address for an inaccurate or denied GPS fix.

If later product research shows a need to correct geocoder mistakes, that should be a separate correction/report mechanism rather than silently replacing the authoritative sweep location.

### 7. Submission and property intelligence handoff

The scan payload should carry the normalized property identity to the backend.

M5 acceptance should leave Milestone 6 able to request the matched/current property and show prior scan/report intelligence without redesigning location identity again.

## Acceptance tests

Test on physical iPhone first, then ensure the shared implementation is compatible with Android for later M16 validation.

Required physical cases:

1. residential street address with good GPS
2. commercial/hotel-style property where the native geocoder returns a named/structured address
3. location where street number is missing
4. reverse-geocoder failure or sparse result, exercising coordinate fallback
5. repeated sweeps from approximately the same place, confirming the same property identity
6. two physically close but distinct addresses, confirming they are not incorrectly merged
7. GPS fix worse than 50 m, confirming progression remains blocked

## M5 exit criteria

- [ ] fresh GPS captured automatically at location stage
- [ ] <=50 m accuracy required
- [ ] native street-level fields captured where available
- [ ] no manual replacement address required
- [ ] normalized shared property identity implemented
- [ ] deterministic coordinate fallback implemented
- [ ] conservative property matching implemented
- [ ] backend property identity/matching updated
- [ ] repeat-scan match physically validated
- [ ] nearby distinct-property non-merge physically validated
- [ ] scan submission persists the resolved identity
- [ ] documentation/SPEC_STATUS updated
- [ ] committed and pushed before Milestone 6
