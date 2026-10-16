"use client";

import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";

export type GlobePoint = { lat: number; lng: number; name: string };
export type GlobeArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

export default function LiveGlobe({
  users = [],
  arcs = [],
  height = 520,
}: {
  users?: GlobePoint[];
  arcs?: GlobeArc[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="w-full" style={{ height }}>
      {width > 0 && (
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/earth-night.jpg"
          atmosphereColor="#2f9bff"
          atmosphereAltitude={0.22}
          onGlobeReady={() => {
            const globe = globeRef.current;
            if (!globe) return;
            const controls = globe.controls();
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            controls.autoRotate = !reduce;
            controls.autoRotateSpeed = 0.6;
            controls.enableZoom = false;
            globe.pointOfView({ lat: 20, lng: 78, altitude: 2.3 });
          }}
          pointsData={users}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => "#ffb85c"}
          pointAltitude={0.02}
          pointRadius={0.5}
          pointLabel="name"
          arcsData={arcs}
          arcColor={() => ["rgba(255,255,255,0.95)", "rgba(79,209,160,0.25)"]}
          arcDashLength={0.4}
          arcDashGap={1}
          arcDashAnimateTime={1800}
          arcStroke={0.45}
        />
      )}
    </div>
  );
}
