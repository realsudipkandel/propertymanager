"use server";

import { MESSAGE } from "@/domain/constants";
import {
  addressSearchQuery,
  draftPropertyFromText,
  PROPERTY_SEARCH_MAX_LENGTH,
  PROPERTY_SEARCH_MIN_LENGTH,
  propertyLocationReady,
  normaliseUkPostcode,
  queryIsUkPostcode,
  resolvePropertyAddressSearch,
  type AddressLookupState,
  type AddressSearchResult,
} from "@/domain/property";
import { canMutateFinance } from "@/domain/permissions";
import { requireSession } from "@/server/session";
import { readUkAddressSearch, readUkPostcode } from "@/server/uk-address";

export async function searchUkPropertyAddresses(query: string): Promise<AddressSearchResult> {
  const session = await requireSession();
  if (!canMutateFinance(session.role)) {
    return { matches: [], message: MESSAGE.UNAUTHORISED };
  }
  const trimmed = query.trim();
  if (trimmed.length < PROPERTY_SEARCH_MIN_LENGTH || trimmed.length > PROPERTY_SEARCH_MAX_LENGTH) {
    return resolvePropertyAddressSearch({
      query: trimmed,
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "skipped",
      postcodePayload: null,
    });
  }
  const local = draftPropertyFromText(trimmed);
  if (propertyLocationReady(local)) {
    return resolvePropertyAddressSearch({
      query: trimmed,
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "skipped",
      postcodePayload: null,
    });
  }
  const addressLookup = await lookupAddress(trimmed);
  const postcodeLookup = await lookupPostcode(trimmed, local.postcode);
  return resolvePropertyAddressSearch({
    query: trimmed,
    addressLookup: addressLookup.state,
    addressPayload: addressLookup.payload,
    postcodeLookup: postcodeLookup.state,
    postcodePayload: postcodeLookup.payload,
  });
}

async function lookupAddress(query: string): Promise<{ state: AddressLookupState; payload: unknown }> {
  if (queryIsUkPostcode(query)) {
    return { state: "skipped", payload: null };
  }
  const payload = await readUkAddressSearch(addressSearchQuery(query));
  return { state: payload === null ? "failed" : "ready", payload };
}

async function lookupPostcode(query: string, parsedPostcode: string): Promise<{ state: AddressLookupState; payload: unknown }> {
  const postcode = queryIsUkPostcode(query) ? normaliseUkPostcode(query) ?? "" : parsedPostcode;
  if (!postcode) {
    return { state: "skipped", payload: null };
  }
  const payload = await readUkPostcode(postcode);
  return { state: payload === null ? "failed" : "ready", payload };
}
