export function addDecimalStrings(a: string, b: string): string {
  const toCents = (s: string): bigint => {
    const t = s.trim();
    const neg = t.startsWith("-");
    const abs = neg ? t.slice(1) : t;
    const [intStr = "0", fracStr = ""] = abs.split(".");
    const cents = BigInt(intStr) * 100n + BigInt((fracStr + "00").slice(0, 2));
    return neg ? -cents : cents;
  };
  const sum = toCents(a) + toCents(b);
  const neg = sum < 0n;
  const abs = neg ? -sum : sum;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
