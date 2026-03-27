import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userLat?: number;
      userLng?: number;
      clinicLat?: number;
      clinicLng?: number;
    };

    const userLat = body.userLat;
    const userLng = body.userLng;
    const clinicLat = body.clinicLat;
    const clinicLng = body.clinicLng;

    if (
      typeof userLat !== "number" ||
      typeof userLng !== "number" ||
      typeof clinicLat !== "number" ||
      typeof clinicLng !== "number"
    ) {
      return NextResponse.json(
        { error: "userLat, userLng, clinicLat, and clinicLng are required numbers." },
        { status: 400 },
      );
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${clinicLng},${clinicLat}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json({ error: "Routing service unavailable." }, { status: 502 });
    }

    const data = (await response.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: number[][] };
        distance?: number;
        duration?: number;
      }>;
    };

    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates) {
      return NextResponse.json({ error: "No route found." }, { status: 404 });
    }

    const coordinates = route.geometry.coordinates.map((point) => [point[1], point[0]] as [number, number]);

    return NextResponse.json({
      coordinates,
      distanceKm: (route.distance ?? 0) / 1000,
      durationMin: (route.duration ?? 0) / 60,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route lookup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

