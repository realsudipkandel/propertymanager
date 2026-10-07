import { describe, expect, it } from "vitest";

import { MESSAGE } from "@/domain/constants";
import {
  addressSearchQuery,
  draftPropertyFromText,
  emptyPropertyDraft,
  localityFromPostcodePayload,
  normaliseUkPostcode,
  postcodeLookupStatus,
  propertyCreateErrors,
  propertyDraftHasSignal,
  propertyDraftsFromSearch,
  propertyLocationReady,
  queryIsUkPostcode,
  resolvePropertyAddressSearch,
} from "@/domain/property";

const canalHouse = {
  name: "Canal House",
  address: "12 Canal Street",
  city: "London",
  postcode: "SW1A 1AA",
  bedroomsRaw: "2",
};

describe("property draft", () => {
  it("reads a pasted address and keeps a UK postcode", () => {
    expect(emptyPropertyDraft()).toEqual({ name: "", address: "", city: "", postcode: "", bedroomsRaw: "" });
    expect(draftPropertyFromText("   ")).toEqual(emptyPropertyDraft());
    expect(draftPropertyFromText("Canal House, 12 Canal Street, London SW1A 1AA, 2 bedrooms")).toEqual(canalHouse);
    expect(draftPropertyFromText("Canal House\n12 Canal Street\nLondon\nSW1A1AA\n2 bed")).toEqual(canalHouse);
    expect(draftPropertyFromText("two-bed apartment, 8 Riverwalk, Staines TW18 4EP")).toEqual({
      name: "Riverwalk",
      address: "8 Riverwalk",
      city: "Staines",
      postcode: "TW18 4EP",
      bedroomsRaw: "2",
    });
    expect(draftPropertyFromText("Studio, 4 River Mews, Staines, TW18 4AJ")).toEqual({
      name: "River Mews",
      address: "4 River Mews",
      city: "Staines",
      postcode: "TW18 4AJ",
      bedroomsRaw: "0",
    });
    expect(draftPropertyFromText("2br, Flat 2, 10 King Street, Manchester, M1 1AE")).toEqual({
      name: "Flat 2",
      address: "10 King Street",
      city: "Manchester",
      postcode: "M1 1AE",
      bedroomsRaw: "2",
    });
    expect(draftPropertyFromText("12 Canal Street, London, United Kingdom, SW1A 1AA")).toEqual({
      name: "Canal Street",
      address: "12 Canal Street",
      city: "London",
      postcode: "SW1A 1AA",
      bedroomsRaw: "",
    });
    expect(draftPropertyFromText("Canal House, 12 Canal Street, Westminster, London SW1A 1AA")).toEqual({
      name: "Canal House",
      address: "12 Canal Street, Westminster",
      city: "London",
      postcode: "SW1A 1AA",
      bedroomsRaw: "",
    });
    expect(draftPropertyFromText("12 Canal Street")).toEqual({
      name: "Canal Street",
      address: "12 Canal Street",
      city: "",
      postcode: "",
      bedroomsRaw: "",
    });
    expect(draftPropertyFromText("1 A")).toEqual({
      name: "1 A",
      address: "1 A",
      city: "",
      postcode: "",
      bedroomsRaw: "",
    });
    expect(draftPropertyFromText("Harbour Flat")).toEqual({
      name: "Harbour Flat",
      address: "",
      city: "",
      postcode: "",
      bedroomsRaw: "",
    });
    expect(draftPropertyFromText("31 bedrooms, 12 Canal Street, London SW1A 1AA").bedroomsRaw).toBe("31");
    expect(normaliseUkPostcode("sw1a1aa")).toBe("SW1A 1AA");
    expect(normaliseUkPostcode("EC1A 1BB")).toBe("EC1A 1BB");
    expect(normaliseUkPostcode("SW1")).toBeNull();
    expect(normaliseUkPostcode("HELLO")).toBeNull();
    expect(queryIsUkPostcode("sw1a 1aa")).toBe(true);
    expect(addressSearchQuery("Harbour Flat, 15 Bank Street, London, 2 bedrooms")).toBe("15 Bank Street, London");
    expect(addressSearchQuery("Harbour Flat")).toBe("Harbour Flat");
    expect(queryIsUkPostcode("12 Canal Street, SW1A 1AA")).toBe(false);
    expect(propertyCreateErrors({ ...canalHouse, postcode: "sw1a1aa" })).toEqual({});
    expect(propertyCreateErrors({ ...canalHouse, postcode: "HELLO", bedroomsRaw: "0" }).postcode).toBe("Enter a UK postcode.");
    expect(propertyCreateErrors({ ...canalHouse, bedroomsRaw: "" }).bedrooms).toBe("Enter the number of bedrooms.");
    expect(propertyCreateErrors({ ...canalHouse, bedroomsRaw: "31" }).bedrooms).toBe("Enter 0 to 30 bedrooms.");
    expect(propertyLocationReady(canalHouse)).toBe(true);
    expect(propertyLocationReady({ ...canalHouse, postcode: "" })).toBe(false);
    expect(propertyDraftHasSignal(emptyPropertyDraft())).toBe(false);
    expect(propertyDraftHasSignal({ ...emptyPropertyDraft(), bedroomsRaw: "1" })).toBe(true);
  });

  it("turns an address search into property drafts", () => {
    const bankStreet = {
      address: {
        road: "Bank Street",
        city: "Greater London",
        postcode: "E14 5JP",
        building: "Canary Wharf",
      },
    };
    expect(propertyDraftsFromSearch(null, "15 Bank Street")).toEqual([]);
    expect(propertyDraftsFromSearch([{ address: { road: "Bank Street", city: "London" } }], "15 Bank Street")).toEqual([]);
    expect(propertyDraftsFromSearch([bankStreet, bankStreet], "15 Bank Street London")).toEqual([{
      name: "Canary Wharf",
      address: "15 Bank Street",
      city: "London",
      postcode: "E14 5JP",
      bedroomsRaw: "",
    }]);
    expect(propertyDraftsFromSearch([null, { address: "Bank Street" }], "15 Bank Street")).toEqual([]);
    expect(propertyDraftsFromSearch([{ address: { road: "Bank Street", city: "City of London", postcode: "E14 5JP" } }], "somewhere else")).toEqual([{
      name: "Bank Street",
      address: "Bank Street",
      city: "London",
      postcode: "E14 5JP",
      bedroomsRaw: "",
    }]);
    expect(propertyDraftsFromSearch([{ address: { house_number: "10", road: "King Street", town: "Manchester", postcode: "M1 1AE" } }], "somewhere else")).toEqual([{
      name: "King Street",
      address: "10 King Street",
      city: "Manchester",
      postcode: "M1 1AE",
      bedroomsRaw: "",
    }]);
    expect(postcodeLookupStatus(null)).toBe("unknown");
    expect(postcodeLookupStatus({ status: 500 })).toBe("unknown");
    expect(postcodeLookupStatus({ status: 404 })).toBe("invalid");
    expect(postcodeLookupStatus({ status: 200, result: { region: "London" } })).toBe("valid");
    expect(localityFromPostcodePayload({ status: 404 })).toBeNull();
    expect(localityFromPostcodePayload({ status: 200 })).toBeNull();
    expect(localityFromPostcodePayload({ status: 200, result: { region: "London", admin_district: "Westminster" } })).toBe("London");
    expect(localityFromPostcodePayload({ status: 200, result: { region: "South East", admin_district: "Spelthorne", admin_ward: "Staines" } })).toBe("Spelthorne");
    expect(localityFromPostcodePayload({ status: 200, result: { region: "South East", admin_ward: "Staines" } })).toBe("Staines");
    expect(localityFromPostcodePayload({ status: 200, result: { region: "South East", admin_district: "X", admin_ward: "12" } })).toBeNull();
  });

  it("keeps a complete paste and fills the gaps from search", () => {
    expect(resolvePropertyAddressSearch({
      query: "SW1",
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "skipped",
      postcodePayload: null,
    }).message).toBe(MESSAGE.PROPERTY_SEARCH_SHORT);
    expect(resolvePropertyAddressSearch({
      query: "x".repeat(161),
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "skipped",
      postcodePayload: null,
    }).message).toBe(MESSAGE.PROPERTY_SEARCH_LONG);
    expect(resolvePropertyAddressSearch({
      query: "Canal House, 12 Canal Street, London SW1A 1AA, 2 bedrooms",
      addressLookup: "ready",
      addressPayload: [{ address: { road: "Other Road", city: "Leeds", postcode: "LS1 1UR", building: "Other" } }],
      postcodeLookup: "ready",
      postcodePayload: { status: 404 },
    }).matches).toEqual([canalHouse]);
    expect(resolvePropertyAddressSearch({
      query: "ZZ99 9ZZ",
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "ready",
      postcodePayload: { status: 404 },
    })).toEqual({ matches: [], message: MESSAGE.PROPERTY_POSTCODE_UNKNOWN });
    expect(resolvePropertyAddressSearch({
      query: "SW1A 1AA",
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "ready",
      postcodePayload: { status: 200, result: { region: "London", admin_district: "Westminster" } },
    }).matches).toEqual([{ name: "", address: "", city: "London", postcode: "SW1A 1AA", bedroomsRaw: "" }]);
    expect(resolvePropertyAddressSearch({
      query: "Harbour Flat, 15 Bank Street, London, 2 bedrooms",
      addressLookup: "ready",
      addressPayload: [{
        address: { road: "Bank Street", city: "Greater London", postcode: "E14 5JP", building: "Canary Wharf" },
      }],
      postcodeLookup: "skipped",
      postcodePayload: null,
    }).matches).toEqual([{
      name: "Harbour Flat",
      address: "15 Bank Street",
      city: "London",
      postcode: "E14 5JP",
      bedroomsRaw: "2",
    }]);
    expect(resolvePropertyAddressSearch({
      query: "12 Canal Street, London",
      addressLookup: "failed",
      addressPayload: null,
      postcodeLookup: "skipped",
      postcodePayload: null,
    })).toEqual({
      matches: [{ name: "Canal Street", address: "12 Canal Street", city: "London", postcode: "", bedroomsRaw: "" }],
      message: MESSAGE.PROPERTY_SEARCH_UNAVAILABLE,
    });
    expect(resolvePropertyAddressSearch({
      query: "england",
      addressLookup: "ready",
      addressPayload: [],
      postcodeLookup: "skipped",
      postcodePayload: null,
    })).toEqual({ matches: [], message: MESSAGE.PROPERTY_SEARCH_NONE });
    expect(resolvePropertyAddressSearch({
      query: "15 Bank Street, 2 bedrooms",
      addressLookup: "ready",
      addressPayload: [{ address: { road: "Bank Street", postcode: "E14 5JP" } }],
      postcodeLookup: "ready",
      postcodePayload: { status: 200, result: { region: "London" } },
    }).matches).toEqual([{
      name: "Bank Street",
      address: "15 Bank Street",
      city: "London",
      postcode: "E14 5JP",
      bedroomsRaw: "2",
    }]);
    expect(resolvePropertyAddressSearch({
      query: "12 Canal Street SW1A 1AA",
      addressLookup: "failed",
      addressPayload: null,
      postcodeLookup: "ready",
      postcodePayload: { status: 200, result: { region: "London", admin_district: "Westminster" } },
    }).matches[0]).toEqual({
      name: "Canal Street",
      address: "12 Canal Street",
      city: "London",
      postcode: "SW1A 1AA",
      bedroomsRaw: "",
    });
    expect(resolvePropertyAddressSearch({
      query: "Harbour Flat",
      addressLookup: "skipped",
      addressPayload: null,
      postcodeLookup: "skipped",
      postcodePayload: null,
    }).matches[0]?.name).toBe("Harbour Flat");
  });
});
