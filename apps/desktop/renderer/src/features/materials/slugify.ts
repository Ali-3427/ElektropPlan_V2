const TURKISH_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

export function slugify(input: string): string {
  const lowered = String(input)
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("")
    .toLowerCase();
  return lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
