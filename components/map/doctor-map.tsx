"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Clinic } from "@/models/types";

// Fix default marker icons in bundlers
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const selectedIcon = L.divIcon({
  className: "healoz-marker-selected",
  html: '<span class="healoz-marker-dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const normalIcon = L.divIcon({
  className: "healoz-marker-normal",
  html: '<span class="healoz-marker-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitToSelection(props: {
  userLocation: { lat: number; lng: number } | null;
  selectedClinic: Clinic | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!props.userLocation || !props.selectedClinic) return;
    map.fitBounds(
      [
        [props.userLocation.lat, props.userLocation.lng],
        [props.selectedClinic.location_lat, props.selectedClinic.location_lng],
      ],
      { padding: [50, 50], animate: true, duration: 1 },
    );
  }, [map, props.selectedClinic, props.userLocation]);

  return null;
}

export function DoctorMap(props: {
  userLocation: { lat: number; lng: number } | null;
  clinics: Clinic[];
  selectedClinicId: string | null;
  onSelectClinic: (clinicId: string) => void;
  routeCoords?: Array<[number, number]>;
}) {
  const center = props.userLocation ?? { lat: 20.5937, lng: 78.9629 }; // fallback: India
  const selectedClinic = useMemo(
    () => props.clinics.find((c) => c.id === props.selectedClinicId) ?? null,
    [props.clinics, props.selectedClinicId],
  );
  const nearestId =
    props.clinics
      .filter((c) => typeof c.distance_km === "number" && Number.isFinite(c.distance_km))
      .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))[0]?.id ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <MapContainer center={[center.lat, center.lng]} zoom={props.userLocation ? 12 : 4} className="h-[360px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToSelection userLocation={props.userLocation} selectedClinic={selectedClinic} />

        {props.userLocation && (
          <Marker position={[props.userLocation.lat, props.userLocation.lng]}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {props.clinics
          .filter((c) => typeof c.location_lat === "number" && typeof c.location_lng === "number")
          .map((c) => {
            const isSelected = c.id === props.selectedClinicId;
            const isNearest = c.id === nearestId;
            const label = `${c.name}${isNearest ? " (Nearest)" : ""}${
              isSelected ? " (Selected)" : ""
            }`;
            return (
              <Marker
                key={c.id}
                position={[c.location_lat as number, c.location_lng as number]}
                icon={isSelected ? selectedIcon : normalIcon}
                opacity={isSelected ? 1 : 0.65}
                eventHandlers={{
                  click: () => props.onSelectClinic(c.id),
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">{label}</div>
                    <div className="text-sm">{c.address}</div>
                    <div className="text-sm">Open slots: {(c.doctor_slots ?? []).length}</div>
                    {Number.isFinite(c.distance_km) && (
                      <div className="text-sm">Distance: {c.distance_km!.toFixed(2)} km</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        {props.routeCoords && props.routeCoords.length > 1 && (
          <Polyline positions={props.routeCoords} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }} />
        )}
      </MapContainer>
    </div>
  );
}

