import { createHmac } from "node:crypto";

function confirmationSecret() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("delivery_confirmation_secret_missing");
  return secret;
}

export function generateDeliveryConfirmationCode(orderKey: string) {
  const digest = createHmac("sha256", confirmationSecret()).update(`delivery-code:${orderKey}`).digest();
  const value = 100000 + (digest.readUInt32BE(0) % 900000);
  return String(value);
}

export function hashDeliveryConfirmationCode(orderKey: string, code: string) {
  return createHmac("sha256", confirmationSecret()).update(`delivery-confirm:${orderKey}:${code}`).digest("hex");
}
