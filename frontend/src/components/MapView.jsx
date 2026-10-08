import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLORS = { greedy: '#2563eb', hungarian: '#ea580c', global_optimization: '#ea580c', llm: '#059669' };
const nameOf = name => name === 'llm' ? 'Local LLM' : name === 'greedy' ? 'Greedy' : name === 'global_optimization' ? 'Global Optimization' : 'Hungarian';
const point = item => [item.location.lat, item.location.lng];

/** Fully offline spatial plot with individual or combined algorithm assignment routes. */
export default function MapView({ resources = [], requests = [], results = [], mapMode = 'both' }) {
  const element = useRef(null);
  const mapRef = useRef(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current).setView([12.9716, 77.5946], 11);
    mapRef.current = map;
    // Deliberately no tile layer: every map feature must work on an air-gapped laptop.
    // Coordinates, zoom, pan, markers, tooltips and assignment routes are all local.
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const resourceById = new Map(resources.map(item => [item.id, item]));
    const requestById = new Map(requests.map(item => [item.id, item]));
    const bounds = [];
    resources.forEach(item => {
      bounds.push(point(item));
      L.circleMarker(point(item), { radius: 8, color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: .9 })
        .bindTooltip(`${item.name} (resource)`).addTo(layer);
    });
    requests.forEach(item => {
      bounds.push(point(item));
      L.circleMarker(point(item), { radius: 8, color: '#991b1b', fillColor: '#dc2626', fillOpacity: .9 })
        .bindTooltip(`${item.title} (request)`).addTo(layer);
    });
    results.filter(result => mapMode === 'both' || mapMode === result.algorithm)
      .forEach((result, index) => {
        const color = COLORS[result.algorithm] || '#059669';
        (result.assignments || []).forEach(assignment => {
          const resource = resourceById.get(assignment.resource_id);
          const request = requestById.get(assignment.request_id);
          if (!resource || !request) return;
          L.polyline([point(resource), point(request)], {
            color, weight: 4, opacity: .8,
            dashArray: result.algorithm === 'greedy' ? undefined : result.algorithm === 'llm' ? '3 8' : '9 7',
            // Offset is not used: overlapping routes can still be distinguished by dash pattern.
          }).bindTooltip(`${nameOf(result.algorithm)}: ${resource.name} → ${request.title}`).addTo(layer);
        });
      });
    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    const legend = L.control({ position: 'topright' });
    legend.onAdd = () => {
      const el = L.DomUtil.create('div', 'mapLegend');
      const algorithms = results.filter(r => mapMode === 'both' || r.algorithm === mapMode);
      el.innerHTML = '<strong>Map legend</strong><div>🔵 Resources · 🔴 Requests</div>' +
        algorithms.map(r => `<div style="color:${COLORS[r.algorithm] || '#059669'}">${r.algorithm === 'greedy' ? '━━━━' : r.algorithm === 'llm' ? '······' : '┄┄┄┄'} ${nameOf(r.algorithm)}</div>`).join('');
      return el;
    };
    legend.addTo(map);
    window.requestAnimationFrame(() => map.invalidateSize());
    return () => { map.removeLayer(layer); map.removeControl(legend); };
  }, [resources, requests, results, mapMode]);
  return <div ref={element} id="map" style={{ width: '100%', height: '100%', minHeight: 350 }} role="img" aria-label={`Allocation map showing ${mapMode === 'both' ? 'all available algorithms' : nameOf(mapMode)}`} />;
}
