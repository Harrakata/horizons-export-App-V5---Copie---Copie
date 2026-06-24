import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LocateFixed,
  Maximize2,
  Minus,
  MapPin,
  MapPinned,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { normalizeMaintenanceText } from '@/lib/maintenanceMonitoring';
import { supabase } from '@/lib/supabaseClient';

const TILE_SIZE = 256;
const MAP_WIDTH = 960;
const MAP_HEIGHT = 520;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const SINGLE_MARKER_ZOOM = 11;
const CACHE_PREFIX = 'maintenance-agency-geocode-v3:';

const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getAgencyAddress = (agence) =>
  String(agence?.adresse || agence?.Adresse || agence?.address || '').trim();

const isMapsUrl = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized.startsWith('http') &&
    (normalized.includes('google.') ||
      normalized.includes('goo.gl/maps') ||
      normalized.includes('maps.app.goo.gl'))
  );
};

const parseCoordinates = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  const valueToParse = safeDecode(rawValue);
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /(?:[?&](?:q|ll|query)=)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  ];

  for (const pattern of patterns) {
    const match = valueToParse.match(pattern);
    if (!match) continue;

    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
};

const buildGoogleMapsUrl = (address) => {
  const trimmedAddress = String(address || '').trim();
  if (!trimmedAddress) return '';

  if (/^https?:\/\//i.test(trimmedAddress)) return trimmedAddress;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedAddress)}`;
};

const buildGoogleEmbedUrl = (address) => {
  const query = String(address || '').trim();
  if (!query) return '';

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
};

const buildCacheKey = (row) =>
  normalizeMaintenanceText(row?.adresse || '');

const readCachedCoordinates = (row) => {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${buildCacheKey(row)}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (isValidCoordinate(parsed?.lat, parsed?.lng)) return parsed;
  } catch {
    return null;
  }

  return null;
};

const cacheCoordinates = (row, coordinates) => {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${buildCacheKey(row)}`,
      JSON.stringify(coordinates)
    );
  } catch {
    // Cache local facultatif.
  }
};

const extractMapsTextQuery = (value) => {
  if (!isMapsUrl(value)) return '';

  const decoded = safeDecode(String(value || '')).replace(/\+/g, ' ');
  const queryMatch = decoded.match(/[?&](?:q|query|destination|daddr)=([^&]+)/i);
  if (queryMatch?.[1] && !parseCoordinates(queryMatch[1])) {
    return safeDecode(queryMatch[1]).replace(/\+/g, ' ').trim();
  }

  const placeMatch = decoded.match(/\/maps\/place\/([^/@?]+)/i);
  if (placeMatch?.[1] && !parseCoordinates(placeMatch[1])) {
    return safeDecode(placeMatch[1]).replace(/\+/g, ' ').trim();
  }

  return '';
};

const getGeocodableAddress = (address) => {
  const trimmedAddress = String(address || '').trim();
  if (!trimmedAddress) return '';

  return isMapsUrl(trimmedAddress) ? extractMapsTextQuery(trimmedAddress) : trimmedAddress;
};

const isShortMapsUrlWithoutReadableLocation = (address) =>
  isMapsUrl(address) && !parseCoordinates(address) && !extractMapsTextQuery(address);

const parseResolvedMapLinkPayload = (payload) => {
  const coordinates = payload?.coordinates;
  if (isValidCoordinate(Number(coordinates?.lat), Number(coordinates?.lng))) {
    return { lat: Number(coordinates.lat), lng: Number(coordinates.lng) };
  }

  return parseCoordinates([payload?.finalUrl, payload?.content, payload?.html].filter(Boolean).join('\n'));
};

const resolveMapLinkWithEdgeFunction = async (address) => {
  try {
    const { data, error } = await supabase.functions.invoke('resolve-map-link', {
      body: { url: address },
    });

    if (error) return null;
    return parseResolvedMapLinkPayload(data);
  } catch {
    return null;
  }
};

const resolveMapLinkWithAllOrigins = async (address) => {
  try {
    const response = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(address)}`
    );
    if (!response.ok) return null;

    const payload = await response.json();
    return parseResolvedMapLinkPayload({
      finalUrl: payload?.status?.url,
      content: payload?.contents,
    });
  } catch {
    return null;
  }
};

const resolveMapLinkDirectly = async (address) => {
  if (!isMapsUrl(address)) return null;

  try {
    const response = await fetch(address, { redirect: 'follow' });
    const parsedFromUrl = parseCoordinates(response.url);
    if (parsedFromUrl) return parsedFromUrl;

    const html = await response.text();
    return parseCoordinates(html);
  } catch {
    return null;
  }
};

const resolveMapsUrlCoordinates = async (address) => {
  if (!isMapsUrl(address)) return null;

  const resolvers = [
    resolveMapLinkWithEdgeFunction,
    resolveMapLinkDirectly,
    resolveMapLinkWithAllOrigins,
  ];

  for (const resolver of resolvers) {
    const coordinates = await resolver(address);
    if (coordinates) return coordinates;
  }

  return null;
};

const geocodeAddress = async (row) => {
  const cached = readCachedCoordinates(row);
  if (cached) return cached;

  const resolvedMapsCoordinates = await resolveMapsUrlCoordinates(row.adresse);
  if (resolvedMapsCoordinates) {
    cacheCoordinates(row, resolvedMapsCoordinates);
    return resolvedMapsCoordinates;
  }

  const geocodableAddress = getGeocodableAddress(row.adresse);
  if (!geocodableAddress) {
    throw new Error('Adresse non localisee');
  }

  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    'accept-language': 'fr',
    q: geocodableAddress,
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  if (!response.ok) throw new Error('Geocodage indisponible');

  const results = await response.json();
  const firstResult = results?.[0];
  const coordinates = {
    lat: Number(firstResult?.lat),
    lng: Number(firstResult?.lon),
  };

  if (isValidCoordinate(coordinates.lat, coordinates.lng)) {
    cacheCoordinates(row, coordinates);
    return coordinates;
  }

  throw new Error('Adresse non localisee');
};

const latLngToPixel = (lat, lng, zoom) => {
  const sinLatitude = Math.sin((lat * Math.PI) / 180);
  const normalizedSin = Math.min(Math.max(sinLatitude, -0.9999), 0.9999);
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + normalizedSin) / (1 - normalizedSin)) / (4 * Math.PI)) *
      scale,
  };
};

const buildViewport = (markers) => {
  if (markers.length === 0) return null;

  if (markers.length === 1) {
    const zoom = SINGLE_MARKER_ZOOM;
    const center = latLngToPixel(markers[0].lat, markers[0].lng, zoom);
    return {
      zoom,
      topLeftX: center.x - MAP_WIDTH / 2,
      topLeftY: center.y - MAP_HEIGHT / 2,
    };
  }

  for (let zoom = 14; zoom >= 3; zoom -= 1) {
    const points = markers.map((marker) => latLngToPixel(marker.lat, marker.lng, zoom));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));

    if (maxX - minX <= MAP_WIDTH - 160 && maxY - minY <= MAP_HEIGHT - 120) {
      return {
        zoom,
        topLeftX: (minX + maxX) / 2 - MAP_WIDTH / 2,
        topLeftY: (minY + maxY) / 2 - MAP_HEIGHT / 2,
      };
    }
  }

  const zoom = 3;
  const points = markers.map((marker) => latLngToPixel(marker.lat, marker.lng, zoom));
  return {
    zoom,
    topLeftX: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2 - MAP_WIDTH / 2,
    topLeftY: (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2 - MAP_HEIGHT / 2,
  };
};

const buildTiles = (viewport) => {
  if (!viewport) return [];

  const maxTile = 2 ** viewport.zoom;
  const minTileX = Math.floor(viewport.topLeftX / TILE_SIZE);
  const maxTileX = Math.ceil((viewport.topLeftX + MAP_WIDTH) / TILE_SIZE);
  const minTileY = Math.floor(viewport.topLeftY / TILE_SIZE);
  const maxTileY = Math.ceil((viewport.topLeftY + MAP_HEIGHT) / TILE_SIZE);
  const tiles = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= maxTile) continue;

      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      tiles.push({
        key: `${viewport.zoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${viewport.zoom}/${wrappedX}/${y}.png`,
        left: ((x * TILE_SIZE - viewport.topLeftX) / MAP_WIDTH) * 100,
        top: ((y * TILE_SIZE - viewport.topLeftY) / MAP_HEIGHT) * 100,
        width: (TILE_SIZE / MAP_WIDTH) * 100,
        height: (TILE_SIZE / MAP_HEIGHT) * 100,
      });
    }
  }

  return tiles;
};

const getMarkerPosition = (marker, viewport) => {
  const point = latLngToPixel(marker.lat, marker.lng, viewport.zoom);
  return {
    left: `${((point.x - viewport.topLeftX) / MAP_WIDTH) * 100}%`,
    top: `${((point.y - viewport.topLeftY) / MAP_HEIGHT) * 100}%`,
  };
};

const clampZoom = (zoom) => Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);

const zoomViewport = (viewport, delta) => {
  if (!viewport) return null;

  const nextZoom = clampZoom(viewport.zoom + delta);
  if (nextZoom === viewport.zoom) return viewport;

  const factor = 2 ** (nextZoom - viewport.zoom);
  const centerX = (viewport.topLeftX + MAP_WIDTH / 2) * factor;
  const centerY = (viewport.topLeftY + MAP_HEIGHT / 2) * factor;

  return {
    zoom: nextZoom,
    topLeftX: centerX - MAP_WIDTH / 2,
    topLeftY: centerY - MAP_HEIGHT / 2,
  };
};

const centerViewportOnMarker = (viewport, marker) => {
  if (!viewport || !marker) return viewport;

  const point = latLngToPixel(marker.lat, marker.lng, viewport.zoom);
  return {
    ...viewport,
    topLeftX: point.x - MAP_WIDTH / 2,
    topLeftY: point.y - MAP_HEIGHT / 2,
  };
};

const getStatusBadgeClassName = (status, mode = 'maintenance') => {
  if (mode === 'planning' && status === 'planned') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'empty') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
};

const getStatusLabel = (row, mode = 'maintenance') => {
  if (mode === 'planning') {
    if (row.status === 'empty') return 'Aucun créneau planifié';
    return `${row.terminalCount} créneau(x) planifié(s)`;
  }

  if (row.status === 'ok') return 'Maintenance à jour';
  if (row.status === 'empty') return 'Aucun terminal visible';
  return `${row.preventiveCount} terminal(aux) à traiter`;
};

const getShortStatusLabel = (status, mode = 'maintenance') => {
  if (mode === 'planning') {
    if (status === 'planned') return 'Planifiée';
    return 'Sans créneau';
  }

  if (status === 'ok') return 'À jour';
  if (status === 'empty') return 'Sans suivi';
  return 'À traiter';
};

const getMarkerClassName = (status, mode = 'maintenance') => {
  if (mode === 'planning' && status === 'planned') return 'bg-blue-500 text-white';
  if (status === 'ok') return 'bg-emerald-500 text-white';
  if (status === 'empty') return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
};

const MaintenanceAgenciesMap = ({
  agencies = [],
  groups = [],
  mode = 'maintenance',
  title = 'Carte des agences',
  description = "Les marqueurs utilisent uniquement le champ Adresse de chaque agence et colorent l'état du suivi maintenance.",
  emptyMessage = 'Aucune agence ne correspond aux filtres de suivi actuels.',
}) => {
  const [locations, setLocations] = useState({});
  const [selectedAgencyKey, setSelectedAgencyKey] = useState(null);
  const [viewportOverride, setViewportOverride] = useState(null);

  const agenciesById = useMemo(
    () =>
      (agencies || []).reduce((accumulator, agency) => {
        accumulator[String(agency.id)] = agency;
        return accumulator;
      }, {}),
    [agencies]
  );

  const agencyRows = useMemo(() => {
    const rowsByAgency = new Map();

    (agencies || []).forEach((agency) => {
      const agencyKey = String(agency?.id || agency?.codePDV || agency?.nom || '').trim();
      if (!agencyKey || rowsByAgency.has(agencyKey)) return;

      rowsByAgency.set(agencyKey, {
        key: agencyKey,
        id: agency?.id || agencyKey,
        nom: agency?.nom || 'Agence non renseignée',
        codePDV: agency?.codePDV || '',
        region: agency?.region || 'N/A',
        adresse: getAgencyAddress(agency),
        terminalCount: 0,
        upToDateCount: 0,
        preventiveCount: 0,
      });
    });

    (groups || []).forEach((group) => {
      const agency = agenciesById[String(group.agenceId)] || null;
      const agencyKey = String(group.agenceId || agency?.id || group.agenceNom || '');
      if (!agencyKey) return;

      if (!rowsByAgency.has(agencyKey)) {
        rowsByAgency.set(agencyKey, {
          key: agencyKey,
          id: agency?.id || group.agenceId || agencyKey,
          nom: agency?.nom || group.agenceNom || 'Agence non renseignée',
          codePDV: agency?.codePDV || '',
          region: agency?.region || group.regionNom || 'N/A',
          adresse: getAgencyAddress(agency),
          terminalCount: 0,
          upToDateCount: 0,
          preventiveCount: 0,
        });
      }

      const row = rowsByAgency.get(agencyKey);
      row.terminalCount += 1;
      if (mode === 'planning') {
        if (group.creneau === 'matin') row.upToDateCount += 1;
        else row.preventiveCount += 1;
      } else if (group.followUp?.label === 'Maintenance à jour') {
        row.upToDateCount += 1;
      } else {
        row.preventiveCount += 1;
      }
    });

    return Array.from(rowsByAgency.values())
      .map((row) => ({
        ...row,
        status: mode === 'planning'
          ? row.terminalCount === 0
            ? 'empty'
            : 'planned'
          : row.terminalCount === 0
              ? 'empty'
              : row.preventiveCount > 0
                ? 'preventive'
                : 'ok',
      }))
      .sort((firstRow, secondRow) =>
        firstRow.region.localeCompare(secondRow.region, 'fr') ||
        firstRow.nom.localeCompare(secondRow.nom, 'fr')
      );
  }, [agencies, agenciesById, groups, mode]);

  useEffect(() => {
    if (agencyRows.length === 0) {
      setSelectedAgencyKey(null);
      return;
    }

    setSelectedAgencyKey((currentKey) =>
      agencyRows.some((row) => row.key === currentKey) ? currentKey : agencyRows[0].key
    );
  }, [agencyRows]);

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      const nextLocations = {};
      const rowsToGeocode = [];

      agencyRows.forEach((row) => {
        const parsedCoordinates = parseCoordinates(row.adresse);
        if (parsedCoordinates) {
          nextLocations[row.key] = { status: 'resolved', ...parsedCoordinates };
          return;
        }

        if (!row.adresse) {
          nextLocations[row.key] = {
            status: 'missing',
            reason: "Adresse d'agence non renseignée.",
          };
          return;
        }

        const cached = readCachedCoordinates(row);
        if (cached) {
          nextLocations[row.key] = { status: 'resolved', ...cached };
          return;
        }

        nextLocations[row.key] = { status: 'loading' };
        rowsToGeocode.push(row);
      });

      if (!cancelled) setLocations(nextLocations);

      for (const row of rowsToGeocode) {
        try {
          const coordinates = await geocodeAddress(row);
          if (cancelled) return;
          setLocations((previousLocations) => ({
            ...previousLocations,
            [row.key]: { status: 'resolved', ...coordinates },
          }));
        } catch {
          if (cancelled) return;
          setLocations((previousLocations) => ({
            ...previousLocations,
            [row.key]: {
              status: 'unresolved',
              reason: isShortMapsUrlWithoutReadableLocation(row.adresse)
                ? 'Lien Google Maps court sans coordonnées lisibles automatiquement.'
                : 'Adresse non localisée automatiquement.',
            },
          }));
        }
      }
    };

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, [agencyRows]);

  const markers = useMemo(
    () =>
      agencyRows
        .map((row) => {
          const location = locations[row.key];
          if (location?.status !== 'resolved') return null;
          return { ...row, lat: location.lat, lng: location.lng };
        })
        .filter(Boolean),
    [agencyRows, locations]
  );

  const fittedViewport = useMemo(() => buildViewport(markers), [markers]);
  const viewport = viewportOverride || fittedViewport;
  const tiles = useMemo(() => buildTiles(viewport), [viewport]);
  const selectedAgency = agencyRows.find((row) => row.key === selectedAgencyKey) || agencyRows[0] || null;
  const selectedLocation = selectedAgency ? locations[selectedAgency.key] : null;
  const unresolvedCount = agencyRows.filter((row) =>
    ['missing', 'unresolved'].includes(locations[row.key]?.status)
  ).length;
  const mapEmbedUrl = selectedAgency
    ? buildGoogleEmbedUrl(selectedAgency.adresse)
    : '';

  useEffect(() => {
    setViewportOverride(null);
  }, [fittedViewport]);

  const handleZoom = (delta) => {
    setViewportOverride((currentViewport) => zoomViewport(currentViewport || fittedViewport, delta));
  };

  const handleFitMarkers = () => {
    setViewportOverride(null);
  };

  const handleMapWheel = (event) => {
    if (!viewport) return;

    event.preventDefault();
    handleZoom(event.deltaY < 0 ? 1 : -1);
  };

  const handleSelectAgency = (agencyKey) => {
    setSelectedAgencyKey(agencyKey);

    const marker = markers.find((item) => item.key === agencyKey);
    setViewportOverride((currentViewport) =>
      currentViewport && marker ? centerViewportOnMarker(currentViewport, marker) : currentViewport
    );
  };

  if (agencyRows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-gradient-to-br from-primary/5 via-white to-cyan-50/50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold text-primary">
            <MapPinned className="h-5 w-5" />
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Localisées : {markers.length}/{agencyRows.length}
          </Badge>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            À préciser : {unresolvedCount}
          </Badge>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr),360px]">
        <div className="relative h-[520px] overflow-hidden bg-slate-100" onWheel={handleMapWheel}>
          {markers.length > 0 && viewport ? (
            <>
              {tiles.map((tile) => (
                <img
                  key={tile.key}
                  src={tile.url}
                  alt=""
                  className="absolute select-none"
                  draggable="false"
                  style={{
                    left: `${tile.left}%`,
                    top: `${tile.top}%`,
                    width: `${tile.width}%`,
                    height: `${tile.height}%`,
                  }}
                />
              ))}

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:80px_80px]" />

              <div className="absolute right-3 top-3 z-20 flex overflow-hidden rounded-xl border bg-white/95 shadow">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-none border-r"
                  onClick={handleFitMarkers}
                  title="Voir toutes les agences localisées"
                  disabled={!viewportOverride}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-none border-r"
                  onClick={() => handleZoom(-1)}
                  title="Dézoomer"
                  disabled={!viewport || viewport.zoom <= MIN_ZOOM}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-none"
                  onClick={() => handleZoom(1)}
                  title="Zoomer"
                  disabled={!viewport || viewport.zoom >= MAX_ZOOM}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="absolute left-3 top-3 z-20 rounded-full border bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow">
                Zoom {viewport.zoom}
              </div>

              {markers.map((marker) => {
                const isSelected = marker.key === selectedAgencyKey;
                const position = getMarkerPosition(marker, viewport);
                return (
                  <button
                    key={marker.key}
                    type="button"
                    className={`absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center transition-transform hover:scale-105 ${
                      isSelected ? 'scale-110' : ''
                    }`}
                    style={position}
                    onClick={() => handleSelectAgency(marker.key)}
                    title={marker.nom}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-lg ${
                        getMarkerClassName(marker.status, mode)
                      }`}
                    >
                      <MapPin className="h-5 w-5" />
                    </span>
                    <span className="mt-1 max-w-[150px] truncate rounded-full border bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow">
                      {marker.nom}
                    </span>
                  </button>
                );
              })}

              {mode === 'planning' ? (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl border bg-white/95 px-3 py-2 text-xs shadow">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Planifiée
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Adresse à préciser
                  </span>
                </div>
              ) : (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl border bg-white/95 px-3 py-2 text-xs shadow">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    À jour
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    À traiter
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Sans suivi
                  </span>
                </div>
              )}
            </>
          ) : mapEmbedUrl ? (
            <iframe
              title="Aperçu Google Maps"
              src={mapEmbedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <LocateFixed className="h-10 w-10 text-muted-foreground/50" />
              <p className="max-w-md text-sm">
                Aucune adresse ne permet encore de placer un marqueur sur la carte.
              </p>
            </div>
          )}
        </div>

        <div className="flex max-h-[520px] flex-col border-t bg-slate-50/70 xl:border-l xl:border-t-0">
          {selectedAgency ? (
            <div className="border-b bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{selectedAgency.nom}</p>
                  <p className="text-xs text-muted-foreground">{selectedAgency.region}</p>
                </div>
                <Badge variant="outline" className={getStatusBadgeClassName(selectedAgency.status, mode)}>
                  {selectedAgency.status === 'ok' ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : (
                    <AlertTriangle className="mr-1 h-3 w-3" />
                  )}
                  {getShortStatusLabel(selectedAgency.status, mode)}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border bg-slate-50 px-2 py-2">
                  <p className="font-semibold text-slate-900">{selectedAgency.terminalCount}</p>
                  <p className="text-muted-foreground">{mode === 'planning' ? 'Créneaux' : 'Terminaux'}</p>
                </div>
                <div className={`rounded-lg border px-2 py-2 ${mode === 'planning' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  <p className="font-semibold">{selectedAgency.upToDateCount}</p>
                  <p>{mode === 'planning' ? 'Matin' : 'À jour'}</p>
                </div>
                <div className={`rounded-lg border px-2 py-2 ${mode === 'planning' ? 'bg-violet-50 text-violet-700' : 'bg-red-50 text-red-700'}`}>
                  <p className="font-semibold">{selectedAgency.preventiveCount}</p>
                  <p>{mode === 'planning' ? 'Après-midi' : 'À traiter'}</p>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                {selectedAgency.adresse || "Aucune adresse renseignée."}
              </p>

              {selectedLocation?.status === 'loading' ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Localisation en cours...
                </p>
              ) : selectedLocation?.status !== 'resolved' ? (
                <p className="mt-2 text-xs text-amber-700">
                  {selectedLocation?.reason || 'Localisation automatique indisponible.'}
                </p>
              ) : null}

              {buildGoogleMapsUrl(selectedAgency.adresse) ? (
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <a href={buildGoogleMapsUrl(selectedAgency.adresse)} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ouvrir dans Google Maps
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {agencyRows.map((row) => {
                const location = locations[row.key];
                const isSelected = row.key === selectedAgencyKey;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => handleSelectAgency(row.key)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'bg-white hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{row.nom}</p>
                        <p className="text-xs text-muted-foreground">{row.region}</p>
                      </div>
                      {location?.status === 'loading' ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : location?.status === 'resolved' ? (
                        <MapPin
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            mode === 'planning' && row.status === 'planned'
                              ? 'text-blue-500'
                              : row.status === 'ok'
                              ? 'text-emerald-500'
                              : row.status === 'empty'
                                ? 'text-amber-500'
                                : 'text-red-500'
                          }`}
                        />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline" className={getStatusBadgeClassName(row.status, mode)}>
                        {getStatusLabel(row, mode)}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceAgenciesMap;
