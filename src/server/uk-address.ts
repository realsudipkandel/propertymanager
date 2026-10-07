const POSTCODE_ENDPOINT = "https://api.postcodes.io/postcodes/";
const ADDRESS_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const LOOKUP_TIMEOUT_MS = 4000;
const ADDRESS_RESULT_LIMIT = "5";
const ADDRESS_USER_AGENT = "PropertyFinance/1.0";
const JSON_HEADERS = { Accept: "application/json" };

export async function readUkPostcode(postcode: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${POSTCODE_ENDPOINT}${encodeURIComponent(postcode)}`, {
      headers: JSON_HEADERS,
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return { status: 404 };
    }
    if (!response.ok) {
      return null;
    }
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export async function readUkAddressSearch(query: string): Promise<unknown | null> {
  const endpoint = new URL(ADDRESS_SEARCH_ENDPOINT);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("countrycodes", "gb");
  endpoint.searchParams.set("limit", ADDRESS_RESULT_LIMIT);
  endpoint.searchParams.set("q", query);
  try {
    const response = await fetch(endpoint, {
      headers: { ...JSON_HEADERS, "User-Agent": ADDRESS_USER_AGENT },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json() as unknown;
  } catch {
    return null;
  }
}
