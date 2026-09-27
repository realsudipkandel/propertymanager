export function postalAddressLines(input: {
  line1: string;
  line2: string | null;
  line3: string | null;
  city: string;
  postcode: string;
}): string[] {
  const locality = [input.city.trim(), input.postcode.trim()].filter((part) => part.length > 0).join(" ");
  return [input.line1, input.line2 ?? "", input.line3 ?? "", locality]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
