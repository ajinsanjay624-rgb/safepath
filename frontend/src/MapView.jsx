import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Locate } from "lucide-react";
import { esc } from "./labels.js";

// CARTO basemaps (made from OpenStreetMap data): colourful in light mode, dark in dark mode.
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';
const theme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const pin = (emoji, color) => L.divIcon({ className: "pin", html: `<span style="--c:${color || "#7c3aed"}"><i>${emoji}</i></span>`, iconSize: [38, 38], iconAnchor: [19, 36], popupAnchor: [0, -32] });
const pulseIcon = L.divIcon({ className: "pulse-wrap", html: '<div class="pulse"></div><div class="dot"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });

/**
 * Thin wrapper around Leaflet.
 * routes:  [{coords, color, active, dash, segments:[{coords,color}], onSelect}]
 * markers: [{pos, icon, color, popup}]   circles: [{pos, color, r, popup}]   heat: [{pos, color, r}]
 * trail:   [[lat,lng],...] breadcrumb line     me: [lat,lng] pulsing "you are here" dot
 */
export default function MapView({ center, routes = [], markers = [], circles = [], heat = [], trail, me, fitTo, onClick, picking, className = "", children }) {
  const el = useRef(null), map = useRef(null), tile = useRef(null), click = useRef(onClick);
  const layer = useRef(null), heatLayer = useRef(null), meLayer = useRef(null);
  click.current = onClick;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false }).setView(center, 14);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    tile.current = L.tileLayer(TILES[theme()], { maxZoom: 19, subdomains: "abcd", attribution: ATTR }).addTo(m);
    m.on("click", (e) => click.current && click.current([e.latlng.lat, e.latlng.lng]));
    map.current = m;
    heatLayer.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    meLayer.current = L.layerGroup().addTo(m);
    const mo = new MutationObserver(() => tile.current.setUrl(TILES[theme()]));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { mo.disconnect(); ro.disconnect(); m.remove(); };
  }, []);

  useEffect(() => { map.current.setView(center, map.current.getZoom()); }, [center[0], center[1]]);

  useEffect(() => {
    const h = heatLayer.current; h.clearLayers();
    heat.forEach((c) => L.circle(c.pos, { radius: c.r || 260, stroke: false, fillColor: c.color, fillOpacity: 0.5, className: "heat", interactive: false }).addTo(h));
  }, [heat]);

  useEffect(() => {
    const g = layer.current; g.clearLayers();
    circles.forEach((c) => L.circle(c.pos, { radius: c.r || 70, color: c.color, fillColor: c.color, fillOpacity: 0.4, weight: 2 }).bindPopup(c.popup || "").addTo(g));
    const line = (pts, o) => L.polyline(pts, { lineCap: "round", lineJoin: "round", bubblingMouseEvents: false, ...o });
    routes.forEach((r) => {
      if (r.active) {
        line(r.coords, { color: "#fff", weight: 12, opacity: 0.95, interactive: false }).addTo(g);
        if (r.segments) r.segments.forEach((s) => line(s.coords, { color: s.color, weight: 7, opacity: 1, interactive: false }).addTo(g));
        else line(r.coords, { color: r.color, weight: 7, interactive: false }).addTo(g);
      } else {
        const l = line(r.coords, { color: r.color, weight: 5, opacity: 0.6, dashArray: r.dash || "8 8" }).addTo(g);
        if (r.onSelect) l.on("click", r.onSelect);
      }
    });
    if (trail?.length > 1) line(trail, { color: "#7c3aed", weight: 5, opacity: 0.85, dashArray: "2 9", interactive: false }).addTo(g);
    markers.forEach((mk) => L.marker(mk.pos, { icon: pin(mk.icon, mk.color) }).bindPopup(mk.popup || "").addTo(g));
  }, [routes, markers, circles, trail]);

  useEffect(() => {
    const g = meLayer.current; g.clearLayers();
    if (me) L.marker(me, { icon: pulseIcon, interactive: false, keyboard: false }).addTo(g);
  }, [me?.[0], me?.[1]]);

  useEffect(() => { if (fitTo && fitTo.length > 1) map.current.fitBounds(fitTo, { padding: [40, 40], maxZoom: 16 }); }, [JSON.stringify(fitTo)]);

  return (
    <div className={"mapbox " + (picking ? "picking " : "") + className}>
      <div ref={el} className="map" />
      {me && <button type="button" className="map-btn" aria-label="Go to my location" onClick={() => map.current.flyTo(me, 16)}><Locate size={20} /></button>}
      {children}
    </div>
  );
}
export { esc };
