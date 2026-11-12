import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Extrai o PNG original de dentro do SVG oficial e remove a cor branca
// do próprio bitmap. A imagem final tem alfa real, sem filtro CSS ou SVG.
const root = process.cwd();
const sourceFile = path.join(root, "public", "logo-26fit-oficial-v2.svg");
const destFile = path.join(root, "public", "logo-26fit-limpa.png");
const svg = await fs.readFile(sourceFile, "utf8");
const match = svg.match(/data:image\/png;base64,([^"\s]+)/);
if (!match) throw new Error("Arquivo oficial não contém o PNG incorporado");

const input = Buffer.from(match[1], "base64");
const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let removed = 0;
let kept = 0;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const originalAlpha = data[i + 3] / 255;
  // Diferença da cor branca. Branco e seus contornos se tornam transparentes,
  // mantendo laranja e cinza das letras e suavizando as bordas.
  const darkness = Math.max(255 - r, 255 - g, 255 - b);
  const opacity = Math.max(0, Math.min(1, (darkness - 6) / 30));
  const finalAlpha = originalAlpha * opacity;
  data[i + 3] = Math.round(finalAlpha * 255);
  if (data[i + 3] === 0) { removed++; continue; }
  kept++;
  if (opacity > 0 && opacity < 1) {
    // Retira o halo branco de pixels anti-serrilhados nas letras.
    data[i] = Math.max(0, Math.min(255, Math.round((r - (1 - opacity) * 255) / opacity)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - opacity) * 255) / opacity)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - opacity) * 255) / opacity)));
  }
}
if (!removed || !kept) {
  throw new Error("Conversão incompleta: não foi possível separar letras e fundo");
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(destFile);
console.log("Logo transparente gerada:", info.width + "x" + info.height,
  "pixels transparentes:", removed, "pixels preservados:", kept);
