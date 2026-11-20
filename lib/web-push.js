import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";

export const pushConfigured = () =>
  Boolean(process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
const b64 = (v) => Buffer.from(v, "base64url");
const base = (v) => Buffer.from(v).toString("base64url");
const extract = (salt, ikm) => createHmac("sha256", salt).update(ikm).digest();
const expand = (prk, info, length) => {
  let prev = Buffer.alloc(0),
    parts = [],
    bytes = 0,
    step = 1;
  while (bytes < length) {
    prev = createHmac("sha256", prk)
      .update(Buffer.concat([prev, info, Buffer.from([step++])]))
      .digest();
    parts.push(prev);
    bytes += prev.length;
  }
  return Buffer.concat(parts).subarray(0, length);
};

export function validPushEndpoint(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.href.length > 1500
    )
      return false;
    return (
      url.hostname === "fcm.googleapis.com" ||
      url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname === "web.push.apple.com" ||
      url.hostname.endsWith(".push.apple.com") ||
      (url.hostname.endsWith(".notify.windows.com") && url.hostname !== "notify.windows.com") ||
      url.hostname === "push.services.mozilla.com"
    );
  } catch {
    return false;
  }
}

function vapidFor(endpoint) {
  const publicKey = b64(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "");
  const privateKey = b64(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32)
    throw Error("Chaves Web Push inválidas.");
  const url = new URL(endpoint);
  const aud = url.origin;
  const header = base(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base(
    JSON.stringify({
      aud,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      sub: "mailto:admin@alissonmeespersonal.com.br",
    }),
  );
  const jwtData = header + "." + payload;
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: base(privateKey),
      x: base(publicKey.subarray(1, 33)),
      y: base(publicKey.subarray(33, 65)),
    },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(jwtData), { key, dsaEncoding: "ieee-p1363" });
  return { jwt: jwtData + "." + base(signature), public: base(publicKey) };
}

function encryptPayload(subscription, message) {
  const userPublic = b64(subscription.p256dh),
    authSecret = b64(subscription.auth);
  if (userPublic.length !== 65 || userPublic[0] !== 4 || authSecret.length !== 16)
    throw Error("Chaves da inscrição inválidas.");
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(userPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), userPublic, serverPublic]);
  const ikm = expand(extract(authSecret, shared), info, 32);
  const salt = randomBytes(16),
    prk = extract(salt, ikm);
  const cek = expand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = expand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const json = Buffer.from(JSON.stringify(message), "utf8");
  if (json.length > 2600) throw Error("Notificação muito extensa.");
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([json, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const record = Buffer.alloc(4);
  record.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, record, Buffer.from([serverPublic.length]), serverPublic, encrypted]);
}

export async function sendWebPush(subscription, message) {
  if (!validPushEndpoint(subscription.endpoint) || !pushConfigured())
    throw Error("Push inválido ou indisponível.");
  const { jwt, public: publicKey } = vapidFor(subscription.endpoint);
  const body = encryptPayload(subscription, message);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    headers: {
      Authorization: "vapid t=" + jwt + ", k=" + publicKey,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "600",
      Urgency: "high",
    },
    body,
    signal: AbortSignal.timeout(9000),
  });
  return { ok: response.ok, status: response.status };
}
