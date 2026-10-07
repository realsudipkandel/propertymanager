import { MESSAGE } from "@/domain/constants";

export const PROPERTY_BEDROOM_MAX = 30;
export const PROPERTY_SEARCH_MIN_LENGTH = 5;
export const PROPERTY_SEARCH_MAX_LENGTH = 160;

const BEDROOM_NUMBER = /\b(\d{1,2})\s*[- ]?\s*(?:bed(?:room)?s?|br)\b/i;
const BEDROOM_WORD = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*[- ]?\s*bed(?:room)?s?\b/i;
const STUDIO_WORD = /\bstudio\b/i;
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/;
const STREET_WORD = /\b(?:street|st|road|rd|lane|ln|avenue|ave|close|court|drive|way|place|gardens|terrace|mews|crescent|walk|grove|wharf|rise)\b/i;
const LEADING_NUMBER = /^\d+[a-z]?(?:\s|$)/i;
const WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const IGNORED_PARTS = new Set([
  "uk",
  "u.k.",
  "united kingdom",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "great britain",
  "apartment",
  "flat",
  "house",
  "studio",
  "property",
  "home",
]);

export type PropertyDraft = {
  name: string;
  address: string;
  city: string;
  postcode: string;
  bedroomsRaw: string;
};

export type AddressLookupState = "skipped" | "failed" | "ready";

export type AddressSearchResult = {
  matches: PropertyDraft[];
  message: string | null;
};

export function emptyPropertyDraft(): PropertyDraft {
  return { name: "", address: "", city: "", postcode: "", bedroomsRaw: "" };
}

export function normaliseUkPostcode(value: string): string | null {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  const outward = match?.[1];
  const inward = match?.[2];
  if (!outward || !inward) {
    return null;
  }
  return `${outward} ${inward}`;
}

export function propertyCreateErrors(input: {
  name: string;
  address: string;
  city: string;
  postcode: string;
  bedroomsRaw: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.length < 2 || input.name.length > 80) {
    errors.name = "Enter the property name.";
  }
  if (input.address.length < 2 || input.address.length > 120) {
    errors.address = "Enter the street address.";
  }
  if (input.city.length < 2 || input.city.length > 80) {
    errors.city = "Enter the city.";
  }
  if (normaliseUkPostcode(input.postcode) === null) {
    errors.postcode = "Enter a UK postcode.";
  }
  if (!/^\d+$/.test(input.bedroomsRaw)) {
    errors.bedrooms = "Enter the number of bedrooms.";
  } else if (Number(input.bedroomsRaw) > PROPERTY_BEDROOM_MAX) {
    errors.bedrooms = "Enter 0 to 30 bedrooms.";
  }
  return errors;
}

export function propertyDraftHasSignal(draft: PropertyDraft): boolean {
  return draft.name.length > 0 || draft.address.length > 0 || draft.city.length > 0 || draft.postcode.length > 0 || draft.bedroomsRaw.length > 0;
}

export function propertyLocationReady(draft: PropertyDraft): boolean {
  return draft.address.length >= 2 && draft.city.length >= 2 && normaliseUkPostcode(draft.postcode) !== null;
}

export function addressSearchQuery(text: string): string {
  const draft = draftPropertyFromText(text);
  if (draft.address.length < 2) {
    return text.trim();
  }
  return [draft.address, draft.city, draft.postcode].filter((part) => part.length > 0).join(", ");
}

export function queryIsUkPostcode(value: string): boolean {
  const normalised = normaliseUkPostcode(value);
  if (!normalised) {
    return false;
  }
  return value.toUpperCase().replace(/\s+/g, "") === normalised.replace(/\s+/g, "");
}

export function draftPropertyFromText(text: string): PropertyDraft {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return emptyPropertyDraft();
  }
  const located = takePostcode(trimmed);
  const counted = readBedrooms(located.rest);
  const parts = assignAddressParts(cleanSegments(splitParts(counted.rest)));
  return {
    name: parts.name.slice(0, 80),
    address: parts.address.slice(0, 120),
    city: parts.city.slice(0, 80),
    postcode: located.postcode,
    bedroomsRaw: counted.bedroomsRaw,
  };
}

export function propertyDraftsFromSearch(payload: unknown, query: string): PropertyDraft[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  const houseNumber = houseNumberFromQuery(query);
  const drafts: PropertyDraft[] = [];
  const seen = new Set<string>();
  for (const record of payload) {
    const draft = propertyDraftFromNominatim(record, houseNumber, query);
    if (!draft) {
      continue;
    }
    const key = `${draft.postcode}|${draft.address.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    drafts.push(draft);
  }
  return drafts;
}

export function postcodeLookupStatus(payload: unknown): "valid" | "invalid" | "unknown" {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }
  const status = (payload as { status?: unknown }).status;
  if (status === 200) {
    return "valid";
  }
  if (status === 404) {
    return "invalid";
  }
  return "unknown";
}

export function localityFromPostcodePayload(payload: unknown): string | null {
  if (postcodeLookupStatus(payload) !== "valid") {
    return null;
  }
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") {
    return null;
  }
  const fields = result as Record<string, unknown>;
  if (readField(fields, "region") === "London") {
    return "London";
  }
  const district = readField(fields, "admin_district");
  if (district.length >= 2 && district.length <= 80) {
    return district;
  }
  const ward = readField(fields, "admin_ward");
  if (ward.length >= 2 && ward.length <= 40 && !/\d/.test(ward)) {
    return ward;
  }
  return null;
}

export function resolvePropertyAddressSearch(input: {
  query: string;
  addressLookup: AddressLookupState;
  addressPayload: unknown;
  postcodeLookup: AddressLookupState;
  postcodePayload: unknown;
}): AddressSearchResult {
  const trimmed = input.query.trim();
  if (trimmed.length < PROPERTY_SEARCH_MIN_LENGTH) {
    return { matches: [], message: MESSAGE.PROPERTY_SEARCH_SHORT };
  }
  if (trimmed.length > PROPERTY_SEARCH_MAX_LENGTH) {
    return { matches: [], message: MESSAGE.PROPERTY_SEARCH_LONG };
  }
  const local = draftPropertyFromText(trimmed);
  if (propertyLocationReady(local)) {
    return { matches: [local], message: null };
  }
  const postcodeStatus = input.postcodeLookup === "ready" ? postcodeLookupStatus(input.postcodePayload) : "unknown";
  if (queryIsUkPostcode(trimmed) && postcodeStatus === "invalid") {
    return { matches: [], message: MESSAGE.PROPERTY_POSTCODE_UNKNOWN };
  }
  const locality = input.postcodeLookup === "ready" ? localityFromPostcodePayload(input.postcodePayload) : null;
  if (input.addressLookup === "ready") {
    const matches = propertyDraftsFromSearch(input.addressPayload, trimmed).map((match) => mergePropertyDraft(local, match, locality));
    const partial = applyLocality(local, locality);
    if (matches.length === 0) {
      return {
        matches: propertyDraftHasSignal(partial) ? [partial] : [],
        message: MESSAGE.PROPERTY_SEARCH_NONE,
      };
    }
    return { matches, message: null };
  }
  if (queryIsUkPostcode(trimmed) && locality && local.postcode) {
    return {
      matches: [{ ...emptyPropertyDraft(), city: locality, postcode: local.postcode, bedroomsRaw: local.bedroomsRaw }],
      message: null,
    };
  }
  const partial = applyLocality(local, locality);
  if (input.addressLookup === "failed") {
    return {
      matches: propertyDraftHasSignal(partial) ? [partial] : [],
      message: MESSAGE.PROPERTY_SEARCH_UNAVAILABLE,
    };
  }
  if (propertyDraftHasSignal(partial)) {
    return { matches: [partial], message: null };
  }
  return { matches: [], message: MESSAGE.PROPERTY_SEARCH_NONE };
}

function takePostcode(text: string): { postcode: string; rest: string } {
  const match = text.toUpperCase().match(UK_POSTCODE);
  const outward = match?.[1];
  const inward = match?.[2];
  if (!match || match.index === undefined || !outward || !inward) {
    return { postcode: "", rest: text };
  }
  const postcode = `${outward} ${inward}`;
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
  return { postcode, rest };
}

function readBedrooms(text: string): { bedroomsRaw: string; rest: string } {
  const numbered = BEDROOM_NUMBER.exec(text);
  const numberedCount = numbered?.[1];
  if (numbered && numberedCount) {
    return { bedroomsRaw: numberedCount, rest: stripStudio(text.replace(numbered[0], " ")) };
  }
  const word = BEDROOM_WORD.exec(text);
  const wordCount = word?.[1];
  const count = wordCount ? WORD_TO_NUMBER[wordCount.toLowerCase()] : undefined;
  if (word && count !== undefined) {
    return { bedroomsRaw: String(count), rest: stripStudio(text.replace(word[0], " ")) };
  }
  if (STUDIO_WORD.test(text)) {
    return { bedroomsRaw: "0", rest: stripStudio(text) };
  }
  return { bedroomsRaw: "", rest: text };
}

function stripStudio(text: string): string {
  return text.replace(STUDIO_WORD, " ");
}

function splitParts(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 1);
}

function cleanSegments(parts: string[]): string[] {
  return parts.filter((part) => !IGNORED_PARTS.has(part.toLowerCase()));
}

function looksLikeStreet(value: string): boolean {
  return LEADING_NUMBER.test(value) || STREET_WORD.test(value);
}

function suggestPropertyName(address: string): string {
  const withoutNumber = address.replace(/^\d+[a-z]?\s+/i, "").trim();
  if (withoutNumber.length >= 2) {
    return withoutNumber.slice(0, 80);
  }
  return address.trim().slice(0, 80);
}

function assignAddressParts(segments: string[]): { name: string; address: string; city: string } {
  const first = segments[0];
  if (!first) {
    return { name: "", address: "", city: "" };
  }
  if (segments.length === 1) {
    if (looksLikeStreet(first)) {
      return { name: suggestPropertyName(first), address: first, city: "" };
    }
    return { name: first, address: "", city: "" };
  }
  const last = segments[segments.length - 1] ?? "";
  const city = looksLikeStreet(last) ? "" : last;
  const body = city ? segments.slice(0, -1) : segments;
  const lead = body[0] ?? "";
  if (body.length >= 2 && lead && !looksLikeStreet(lead)) {
    return { name: lead, address: body.slice(1).join(", "), city };
  }
  return { name: suggestPropertyName(lead), address: body.join(", "), city };
}

function houseNumberFromQuery(query: string): string {
  const match = readBedrooms(query).rest.match(/\b(\d+[a-z]?)\b/i);
  return match?.[1] ?? "";
}

function readField(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function tidyCity(value: string): string {
  if (/^greater london$/i.test(value) || /^city of london$/i.test(value)) {
    return "London";
  }
  return value;
}

function propertyDraftFromNominatim(record: unknown, houseNumber: string, query: string): PropertyDraft | null {
  if (!record || typeof record !== "object") {
    return null;
  }
  const address = (record as { address?: unknown }).address;
  if (!address || typeof address !== "object") {
    return null;
  }
  const fields = address as Record<string, unknown>;
  const postcode = normaliseUkPostcode(readField(fields, "postcode"));
  const road = readField(fields, "road");
  if (!postcode || road.length < 2) {
    return null;
  }
  const house = readField(fields, "house_number");
  const queryMentionsRoad = query.toLowerCase().includes(road.toLowerCase());
  const line = house.length > 0
    ? `${house} ${road}`
    : houseNumber.length > 0 && queryMentionsRoad
      ? `${houseNumber} ${road}`
      : road;
  const city = [readField(fields, "city"), readField(fields, "town"), readField(fields, "village"), readField(fields, "city_district"), readField(fields, "suburb")]
    .map(tidyCity)
    .find((part) => part.length >= 2) ?? "";
  const building = readField(fields, "building");
  return {
    name: building.length >= 2 ? building.slice(0, 80) : suggestPropertyName(line),
    address: line.slice(0, 120),
    city: city.slice(0, 80),
    postcode,
    bedroomsRaw: "",
  };
}

function preferredCity(localCity: string, matchCity: string, locality: string | null): string {
  if (localCity.length >= 2) {
    return localCity;
  }
  if (matchCity.length >= 2) {
    return matchCity;
  }
  return locality ?? "";
}

function applyLocality(draft: PropertyDraft, locality: string | null): PropertyDraft {
  if (draft.city.length >= 2 || !locality) {
    return draft;
  }
  return { ...draft, city: locality };
}

function mergePropertyDraft(local: PropertyDraft, match: PropertyDraft, locality: string | null): PropertyDraft {
  const named = local.name.length >= 2 && !looksLikeStreet(local.name) ? local.name : match.name;
  return {
    name: named,
    address: match.address || local.address,
    city: preferredCity(local.city, match.city, locality),
    postcode: match.postcode || local.postcode,
    bedroomsRaw: local.bedroomsRaw || match.bedroomsRaw,
  };
}
