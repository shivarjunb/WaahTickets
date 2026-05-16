import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { EventMapPopup } from './EventMapPopup'

// Carto Dark Matter — free tiles, no API key needed
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>'

const CATEGORY_CONFIG: Record<string, { color: string; svgPath: string }> = {
  'Concert': {
    color: '#e91e63',
    svgPath: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  },
  'Food & Drink': {
    color: '#ff9800',
    svgPath: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  },
  'Festival': {
    color: '#9c27b0',
    svgPath: '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
  },
  'Sports': {
    color: '#22c55e',
    svgPath: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>',
  },
  'Comedy': {
    color: '#3b82f6',
    svgPath: '<circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  },
  'Nightlife': {
    color: '#06b6d4',
    svgPath: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  },
}

const DEFAULT_CFG = {
  color: '#e91e63',
  svgPath: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
}

function buildPinHtml(color: string, svgPath: string, featured: boolean): string {
  return `
    <div class="map-leaflet-pin${featured ? ' pin-featured' : ''}" style="--pin-color:${color}">
      <div class="pin-ripple pin-ripple-outer"></div>
      <div class="pin-ripple pin-ripple-inner"></div>
      <div class="pin-body">
        <svg viewBox="0 0 24 24" width="13" height="13" stroke="white" fill="none"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </div>
    </div>
  `
}

export interface PopupField {
  field: string
  label: string
  visible: boolean
}

export interface MapEvent {
  id: string
  title: string
  category: string
  area: string
  time: string
  priceFrom: string
  sponsored: boolean
  lat: number
  lng: number
  popupConfig?: PopupField[]
  distance?: number
  bearing?: string
  imageUrl?: string
}

export interface UserLocation {
  lat: number
  lng: number
}

interface ActiveCard {
  event: MapEvent
  x: number
  y: number
}

interface KathmanduMapProps {
  events: MapEvent[]
  totalCount: number
  onViewDetails: (eventId: string) => void
  userLocation?: UserLocation | null
  maxDistance?: number | null
}

function radiusBounds(lat: number, lng: number, km: number): L.LatLngBounds {
  const dLat = km / 111
  const dLng = km / (111 * Math.cos(lat * Math.PI / 180))
  return L.latLngBounds([lat - dLat, lng - dLng], [lat + dLat, lng + dLng])
}

export function KathmanduMap({ events, totalCount, onViewDetails, userLocation, maxDistance }: KathmanduMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const userMarkerRef = useRef<L.Marker | null>(null)
  const pathRef = useRef<L.Polyline | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeCard, setActiveCard] = useState<ActiveCard | null>(null)

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setActiveCard(null), 200)
  }

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [27.7172, 85.324],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer(TILE_URL, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map)

    L.control.attribution({ prefix: false, position: 'bottomleft' })
      .addAttribution(TILE_ATTRIBUTION)
      .addTo(map)

    map.on('movestart', () => {
      cancelClose()
      setActiveCard(null)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync markers whenever filtered events change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    events.forEach((event) => {
      const cfg = CATEGORY_CONFIG[event.category] ?? DEFAULT_CFG
      const color = cfg.color
      const featured = event.sponsored
      const pinSize = featured ? 52 : 40

      const icon = L.divIcon({
        className: '',
        html: buildPinHtml(color, cfg.svgPath, featured),
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize / 2],
      })

      const marker = L.marker([event.lat, event.lng], { icon }).addTo(map)

      marker.on('mouseover', () => {
        cancelClose()
        const pt = map.latLngToContainerPoint([event.lat, event.lng])
        setActiveCard({ event, x: pt.x, y: pt.y })
      })

      marker.on('mouseout', scheduleClose)

      marker.on('click', () => {
        const pt = map.latLngToContainerPoint([event.lat, event.lng])
        setActiveCard({ event, x: pt.x, y: pt.y })
      })

      markersRef.current.push(marker)
    })
  }, [events])

  // Sync "you are here" marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null }
    if (!userLocation) return

    const icon = L.divIcon({
      className: '',
      html: '<div class="user-location-pin"><div class="user-loc-pulse"></div><div class="user-loc-dot"></div></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: -100 }).addTo(map)
  }, [userLocation])

  // Zoom map to distance radius when filter chip is clicked
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (maxDistance && userLocation) {
      map.fitBounds(radiusBounds(userLocation.lat, userLocation.lng, maxDistance), {
        padding: [32, 32],
        animate: true,
        duration: 0.5,
      })
    } else if (!maxDistance && events.length > 0) {
      const bounds = L.latLngBounds(events.map((e) => [e.lat, e.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 0.5 })
    }
  }, [maxDistance, userLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Draw / clear animated route path when active card or user location changes
  useEffect(() => {
    const map = mapRef.current
    if (pathRef.current) { pathRef.current.remove(); pathRef.current = null }
    if (!activeCard || !userLocation || !map) return

    const { event } = activeCard
    let cancelled = false

    function renderLine(coords: [number, number][]) {
      if (cancelled || !map) return
      if (pathRef.current) { pathRef.current.remove(); pathRef.current = null }

      const line = L.polyline(coords, {
        color: '#93c5fd',
        weight: 3,
        opacity: 0.9,
        className: 'route-path-line',
      }).addTo(map)

      requestAnimationFrame(() => {
        const el = line.getElement() as SVGPathElement | null
        if (!el) return
        const len = el.getTotalLength()
        if (!len) return
        el.style.strokeDasharray = `${len}`
        el.style.strokeDashoffset = `${len}`
        void el.getBoundingClientRect()
        el.style.transition = 'stroke-dashoffset 0.9s ease'
        el.style.strokeDashoffset = '0'
        el.addEventListener('transitionend', () => {
          el.style.transition = ''
          el.style.strokeDasharray = '7 5'
          el.classList.add('route-path-animated')
        }, { once: true })
      })

      pathRef.current = line
    }

    const fallback: [number, number][] = [
      [userLocation.lat, userLocation.lng],
      [event.lat, event.lng],
    ]

    // OSRM public routing API — free, no key, OSM road network
    const osrm = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${event.lng},${event.lat}?overview=full&geometries=geojson`

    fetch(osrm)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const geoCoords: [number, number][] | undefined = data.routes?.[0]?.geometry?.coordinates
        if (!geoCoords?.length) { renderLine(fallback); return }
        // OSRM returns [lng, lat]; Leaflet wants [lat, lng]
        renderLine(geoCoords.map(([lng, lat]) => [lat, lng]))
      })
      .catch(() => { if (!cancelled) renderLine(fallback) })

    return () => {
      cancelled = true
      if (pathRef.current) { pathRef.current.remove(); pathRef.current = null }
    }
  }, [activeCard, userLocation])

  const handleZoom = (dir: 'in' | 'out') => {
    const map = mapRef.current
    if (!map) return
    dir === 'in' ? map.zoomIn() : map.zoomOut()
  }

  const cardCategoryColor =
    activeCard ? (CATEGORY_CONFIG[activeCard.event.category]?.color ?? '#e91e63') : '#e91e63'

  return (
    <div className="hero-live-map-canvas">
      <div ref={containerRef} className="kathmandu-map-container" />

      {activeCard && (() => {
        const mapW = containerRef.current?.clientWidth ?? 600
        const mapH = containerRef.current?.clientHeight ?? 400
        const CARD_W = 290
        const MARGIN = 10
        // Clamp horizontally so card never leaves the map
        const clampedX = Math.max(
          CARD_W / 2 + MARGIN,
          Math.min(activeCard.x, mapW - CARD_W / 2 - MARGIN)
        )
        // If pin is in the top 180px, show card below pin instead of above
        const below = activeCard.y < 180
        const style: React.CSSProperties = {
          position: 'absolute',
          left: clampedX,
          top: activeCard.y,
          transform: below
            ? 'translateX(-50%) translateY(14px)'
            : 'translateX(-50%) translateY(calc(-100% - 14px))',
          zIndex: 1000,
          pointerEvents: 'auto',
          maxWidth: `${mapW - MARGIN * 2}px`,
        }
        return (
          <div style={style} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
            <EventMapPopup
              title={activeCard.event.title}
              category={activeCard.event.category}
              area={activeCard.event.area}
              time={activeCard.event.time}
              priceFrom={activeCard.event.priceFrom}
              sponsored={activeCard.event.sponsored}
              eventId={activeCard.event.id}
              categoryColor={cardCategoryColor}
              popupConfig={activeCard.event.popupConfig}
              distance={activeCard.event.distance}
              bearing={activeCard.event.bearing}
              imageUrl={activeCard.event.imageUrl}
              below={below}
              onViewDetails={onViewDetails}
              onDirections={() => {
                const { lat, lng } = activeCard.event
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                  '_blank'
                )
              }}
            />
          </div>
        )
      })()}

      {/* Live counter — bottom right */}
      <div className="hero-map-live-counter" aria-live="polite">
        <span className="hero-map-live-dot" />
        <span>{totalCount} Live Events Now</span>
      </div>

      {/* Zoom controls */}
      <div className="hero-map-controls">
        <button
          className="hero-map-control-btn hero-map-control-btn--active"
          type="button"
          aria-label="Zoom in"
          onClick={() => handleZoom('in')}
        >
          +
        </button>
        <button
          className="hero-map-control-btn hero-map-control-btn--active"
          type="button"
          aria-label="Zoom out"
          onClick={() => handleZoom('out')}
        >
          −
        </button>
      </div>
    </div>
  )
}
