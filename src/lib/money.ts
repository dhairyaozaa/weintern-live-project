export const INR = "₹";

export function fmtMoney(ps: number): string {
  return `${INR}${(ps / 100).toLocaleString("en-IN", {
    minimumFractionDigits: ps % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export const toPs = (rupees: number) => Math.round(rupees * 100);

export const DEFAULT_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? 500);

export const CONVENIENCE_FEE_BPS = Number(process.env.CONVENIENCE_FEE_BPS ?? 200);

export function bps(amountPs: number, bpsValue: number): number {
  return Math.round((amountPs * bpsValue) / 10_000);
}
