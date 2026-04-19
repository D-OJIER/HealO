import type { Coordinates } from "@/lib/types";

const KM_EARTH_RADIUS = 6371;

function deg2rad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(origin: Coordinates, destination: Coordinates) {
  const dLat = deg2rad(destination.lat - origin.lat);
  const dLng = deg2rad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(origin.lat)) *
      Math.cos(deg2rad(destination.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * KM_EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

export function directionsUrl(coords: Coordinates, label?: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}${
    label ? `&destination_place_id=${encodeURIComponent(label)}` : ""
  }`;
}

export function mapEmbedUrl(coords: Coordinates) {
  const delta = 0.02;
  const bbox = [
    coords.lng - delta,
    coords.lat - delta,
    coords.lng + delta,
    coords.lat + delta
  ].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;
}
