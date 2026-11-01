// Output screening for Q suggestions. Pure and deterministic so it is unit-tested;
// anything that fails is discarded and the author writes the hint themselves.
const MAX = 300;
const blocked: RegExp[] = [
  /https?:\/\/|www\.|\.com\b|\.org\b|\.net\b/i, // links
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/, // email addresses
  /\+?\d[\d\s().-]{7,}\d/, // phone-like numbers
  /\b(ask me|tell me|chat with|message me|dm me|your (address|school|phone|email|full name))\b/i, // conversation / personal data
  /\b(answer is|correct (answer|option) is|the right answer)\b/i, // giving the answer away
  /\b(kill|suicide|sex|drugs?|weapon|gun|hate)\b/i, // unsafe topics for a hint
  /[<>{}]|```/, // markup or code
];

export function screenHint(raw: string, options: readonly string[] = []) {
  const text = raw
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
  if (text.length < 10 || text.length > MAX) return null;
  if (blocked.some((r) => r.test(text))) return null;
  // Naming an option verbatim tends to point at the answer.
  if (
    options.some(
      (o) =>
        o.trim().length >= 4 &&
        text.toLowerCase().includes(o.trim().toLowerCase()),
    )
  )
    return null;
  return text;
}
