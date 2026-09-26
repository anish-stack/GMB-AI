/** Shared (browser + server) map math for the rank grid. */
export function mapZoom(lat, spanKm) {
  for (let z = 17; z >= 3; z--) {
    const mPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
    if ((spanKm * 1000) / mPerPx <= 640 * 0.85) return z;
  }
  return 3;
}

const worldX = (lng, z) => ((lng + 180) / 360) * 256 * 2 ** z;
const worldY = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z;
};

/** Pixel position of lat/lng on a 640x640 static map centred at (cLat,cLng). */
export function project(lat, lng, cLat, cLng, z) {
  return { x: 320 + (worldX(lng, z) - worldX(cLng, z)), y: 320 + (worldY(lat, z) - worldY(cLat, z)) };
}

export function rankColor(rank) {
  if (!rank) return "#e11d48";
  if (rank <= 3) return "#059669";
  if (rank <= 7) return "#84cc16";
  if (rank <= 10) return "#f59e0b";
  return "#f97316";
}
