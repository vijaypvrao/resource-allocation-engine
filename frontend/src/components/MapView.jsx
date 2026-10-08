import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_MARKER_LIMIT, MAP_ROUTE_LIMIT, sampleMapPoints, sampleMapRoutes } from './mapSampling.js';

const COLORS = { greedy: '#2563eb', hungarian: '#ea580c', global_optimization: '#ea580c', llm: '#059669', scalable_heuristic: '#7c3aed' };
const nameOf = name => name === 'scalable_heuristic' ? 'Scalable Deterministic' : name === 'llm' ? 'LLM' : name === 'greedy' ? 'Greedy' : name === 'global_optimization' ? 'Global Optimization' : 'Hungarian';
const point = item => [item.location.lat, item.location.lng];

/** Offline spatial plot. Visual sampling never modifies computed assignments or metrics. */
export default function MapView({ resources = [], requests = [], results = [], mapMode = 'both' }) {
  const element = useRef(null);
  const mapRef = useRef(null);
  const [display, setDisplay] = useState(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { preferCanvas: true }).setView([12.9716, 77.5946], 11);
    mapRef.current = map;
    // No remote tile services: works without a network connection.
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const visibleResults = results.filter(result => mapMode === 'both' || mapMode === result.algorithm);
    const displayResources = sampleMapPoints(resources, MAP_MARKER_LIMIT);
    const displayRequests = sampleMapPoints(requests, MAP_MARKER_LIMIT);
    const bounds = [];
    for (const item of displayResources) {
      bounds.push(point(item));
      L.circleMarker(point(item), { radius: 6, color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: .85 })
        .bindTooltip(`${item.name} (resource)`).addTo(layer);
    }
    for (const item of displayRequests) {
      bounds.push(point(item));
      L.circleMarker(point(item), { radius: 6, color: '#991b1b', fillColor: '#dc2626', fillOpacity: .85 })
        .bindTooltip(`${item.title} (request)`).addTo(layer);
    }
    // Only index endpoints selected for displayed routes. No dense pairwise matrix.
    const selectedRoutes = visibleResults.map(result => ({ ...result, displayed: sampleMapRoutes(result.assignments || [], MAP_ROUTE_LIMIT) }));
    const resourceIds = new Set();
    const requestIds = new Set();
    for (const result of selectedRoutes) for (const assignment of result.displayed) {
      resourceIds.add(assignment.resource_id);
      requestIds.add(assignment.request_id);
    }
    const resourceById = new Map(resources.filter(item => resourceIds.has(item.id)).map(item => [item.id, item]));
    const requestById = new Map(requests.filter(item => requestIds.has(item.id)).map(item => [item.id, item]));
    for (const result of selectedRoutes) {
      const color = COLORS[result.algorithm] || '#059669';
      for (const assignment of result.displayed) {
        const resource = resourceById.get(assignment.resource_id);
        const request = requestById.get(assignment.request_id);
        if (!resource?.location || !request?.location) continue;
        L.polyline([point(resource), point(request)], {
          color, weight: 3, opacity: .75,
          dashArray: result.algorithm === 'greedy' ? undefined : result.algorithm === 'llm' ? '3 8' : '9 7',
        }).bindTooltip(`${nameOf(result.algorithm)}: ${resource.name} → ${request.title}`).addTo(layer);
      }
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    const legend = L.control({ position: 'topright' });
    legend.onAdd = () => {
      const el = L.DomUtil.create('div', 'mapLegend');
      const heading = L.DomUtil.create('strong', '', el);
      heading.textContent = 'Map legend';
      const markers = L.DomUtil.create('div', '', el);
      markers.textContent = '🔵 Resources · 🔴 Requests';
      for (const result of visibleResults) {
        const line = L.DomUtil.create('div', '', el);
        line.style.color = COLORS[result.algorithm] || '#059669';
        line.textContent = `${result.algorithm === 'greedy' ? '━━━━' : result.algorithm === 'llm' ? '······' : '┄┄┄┄'} ${nameOf(result.algorithm)}`;
      }
      return el;
    };
    legend.addTo(map);
    setDisplay({ resources: displayResources.length, requests: displayRequests.length, totalResources: resources.length, totalRequests: requests.length,
      routes: selectedRoutes.map(r => ({ algorithm: r.algorithm, shown: r.displayed.length, total: (r.assignments || []).length })) });
    window.requestAnimationFrame(() => map.invalidateSize());
    return () => { map.removeLayer(layer); map.removeControl(legend); };
  }, [resources, requests, results, mapMode]);

  const reduced = display && (display.resources < display.totalResources || display.requests < display.totalRequests || display.routes.some(r => r.shown < r.total));
  return <div style={{ width: '100%', height: '100%', minHeight: 350 }}>
    {reduced && <div role="status" style={{ fontSize: 12, padding: '6px 10px' }}>
      Map preview: {display.resources.toLocaleString()} / {display.totalResources.toLocaleString()} resources, {display.requests.toLocaleString()} / {display.totalRequests.toLocaleString()} requests;
      {' '}{display.routes.map(r => `${nameOf(r.algorithm)} ${r.shown.toLocaleString()} / ${r.total.toLocaleString()} routes`).join('; ')}.
      {' '}Full allocation metrics and results are unchanged.
    </div>}
    <div ref={element} id="map" style={{ width: '100%', height: '100%', minHeight: 350 }} role="img" aria-label={`Allocation map showing ${mapMode === 'both' ? 'all available algorithms' : nameOf(mapMode)}`} />
  </div>;
}
