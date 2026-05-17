import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Music, Utensils, Star, Trophy, Laugh, Moon, X, LocateFixed } from 'lucide-react'
import { NepalMap } from './NepalMap'
import type { MapEvent, PopupField, UserLocation } from './NepalMap'
import type { PublicEvent } from '../../shared/types'
import { formatEventDate, formatEventTime, formatMoney } from '../../shared/utils'

// ─── Geo utilities ────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingLabel(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const lat1R = lat1 * Math.PI / 180
  const lat2R = lat2 * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2R)
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng)
  const bearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(bearing / 45) % 8]
}

// ─── Convert a real PublicEvent → MapEvent ────────────────────────────────────
export function toMapEvent(ev: PublicEvent): MapEvent | null {
  if (ev.location_lat == null || ev.location_lng == null) return null

  const dateStr = ev.start_datetime
    ? `${formatEventDate(ev.start_datetime)}, ${formatEventTime(ev.start_datetime)}`
    : 'Date TBD'

  const priceFrom = ev.starting_price_paisa != null
    ? (ev.starting_price_paisa === 0 ? 'Free Entry' : `Rs. ${formatMoney(ev.starting_price_paisa)}`)
    : 'See details'

  let popupConfig: PopupField[] | undefined
  if (ev.map_popup_config) {
    try { popupConfig = JSON.parse(ev.map_popup_config) } catch { /* ignore */ }
  }

  return {
    id: ev.id ?? '',
    title: ev.name ?? 'Untitled Event',
    category: ev.map_pin_icon ?? ev.event_type ?? 'Concert',
    area: ev.location_name ?? ev.location_address ?? 'Kathmandu',
    time: dateStr,
    priceFrom,
    sponsored: Boolean(ev.is_featured),
    lat: ev.location_lat,
    lng: ev.location_lng,
    popupConfig,
    imageUrl: ev.banner_public_url
      ? String(ev.banner_public_url)
      : ev.banner_file_id && ev.id
        ? `/api/public/events/${encodeURIComponent(String(ev.id))}/banner`
        : undefined,
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'All',          value: 'all',          Icon: Star },
  { label: 'Concerts',     value: 'Concert',      Icon: Music },
  { label: 'Festivals',    value: 'Festival',     Icon: Star },
  { label: 'Sports',       value: 'Sports',       Icon: Trophy },
  { label: 'Comedy',       value: 'Comedy',       Icon: Laugh },
  { label: 'Food & Drink', value: 'Food & Drink', Icon: Utensils },
  { label: 'Nightlife',    value: 'Nightlife',    Icon: Moon },
]

const DISTANCE_OPTIONS = [
  { label: '2 km',   value: 2 },
  { label: '5 km',   value: 5 },
  { label: '10 km',  value: 10 },
  { label: '20 km',  value: 20 },
  { label: '100 km', value: 100 },
]

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied'

function formatLiveTime() {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface HeroLiveMapProps {
  searchQuery?: string
  onSearchChange?: (value: string) => void
  onSearchSubmit?: () => void
  onNavigate?: (path: string) => void
  onViewEventDetails?: (eventId: string) => void
  realEvents?: PublicEvent[]
}

export function HeroLiveMap({
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  onNavigate,
  onViewEventDetails,
  realEvents = [],
}: HeroLiveMapProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [maxDistance, setMaxDistance] = useState<number | null>(null)
  const [liveTime, setLiveTime] = useState(formatLiveTime)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  // Live clock — ticks every minute (seconds not needed visually)
  useEffect(() => {
    const id = setInterval(() => setLiveTime(formatLiveTime()), 10_000)
    return () => clearInterval(id)
  }, [])

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); return }
    setLocationStatus('requesting')
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('granted')
      },
      () => { setLocationStatus('denied') },
      { enableHighAccuracy: true, maximumAge: 30_000 },
    )
  }

  const baseEvents = useMemo<MapEvent[]>(() =>
    realEvents.flatMap((ev) => { const m = toMapEvent(ev); return m ? [m] : [] })
  , [realEvents])

  // searchQuery prop is used directly — any caller (navbar or fullscreen search) drives the filter
  const categoryFiltered = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    return baseEvents.filter((event) => {
      if (selectedCategory !== 'all' && event.category !== selectedCategory) return false
      if (search) {
        const haystack = [event.title, event.area, event.category].join(' ').toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [baseEvents, searchQuery, selectedCategory])

  const annotatedEvents = useMemo<MapEvent[]>(() => {
    if (!userLocation) return categoryFiltered
    return categoryFiltered.map((ev) => ({
      ...ev,
      distance: haversineKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng),
      bearing: bearingLabel(userLocation.lat, userLocation.lng, ev.lat, ev.lng),
    }))
  }, [categoryFiltered, userLocation])

  const filteredEvents = useMemo(() => {
    if (!maxDistance || !userLocation) return annotatedEvents
    return annotatedEvents.filter((ev) => (ev.distance ?? Infinity) <= maxDistance)
  }, [annotatedEvents, maxDistance, userLocation])

  const handleViewDetails = (eventId: string) => {
    if (onViewEventDetails) { onViewEventDetails(eventId); return }
    if (onNavigate) onNavigate(`/events/${eventId}`)
  }

  function toggleDistance(value: number) {
    setMaxDistance((prev) => prev === value ? null : value)
  }

  return (
    <section className="hero-live-map-section" id="featured">

      {/* Full-bleed map — fills the entire section */}
      <div className="hero-live-map-canvas-wrapper">
        <NepalMap
          events={filteredEvents}
          totalCount={filteredEvents.length}
          onViewDetails={handleViewDetails}
          userLocation={userLocation}
          maxDistance={maxDistance}
        />

        <div className="hero-map-edge-fade" aria-hidden="true" />
        <div className="hero-map-scan-line" aria-hidden="true" />
        <div className="hero-map-hud-frame" aria-hidden="true">
          <span className="hud-corner hud-corner-tl" />
          <span className="hud-corner hud-corner-tr" />
          <span className="hud-corner hud-corner-bl" />
          <span className="hud-corner hud-corner-br" />
        </div>

        <div className="hero-map-locate-overlay">
          {locationStatus === 'granted' ? (
            <>
              <LocateFixed size={11} className="hero-map-locate-icon" />
              {DISTANCE_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={`hero-map-distance-chip${maxDistance === value ? ' active' : ''}`}
                  onClick={() => toggleDistance(value)}
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            <button
              type="button"
              className={`hero-map-locate-btn${locationStatus === 'denied' ? ' denied' : ''}`}
              disabled={locationStatus === 'requesting'}
              onClick={requestLocation}
            >
              <LocateFixed size={12} />
              {locationStatus === 'requesting' ? 'Locating…'
                : locationStatus === 'denied' ? 'Location unavailable'
                : 'Show my location'}
            </button>
          )}
        </div>
      </div>

      {/* Search — hidden by default, floats to top-left in fullscreen via CSS */}
      <div className="hero-live-map-search">
        <div className="hero-search-input-wrapper">
          <Search size={17} className="hero-search-icon" />
          <input
            aria-label="Search events, venues, artists"
            className="hero-search-input"
            placeholder="Search events, venues, artists..."
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && onSearchSubmit) onSearchSubmit() }}
          />
          {searchQuery && (
            <button type="button" className="hero-search-clear" onClick={() => onSearchChange?.('')} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Top-left content overlay — hidden in fullscreen to avoid z-index conflicts */}
      <div className="hero-live-map-content">

        {/* Live clock */}
        <div className="hero-map-time-badge" aria-live="polite">
          {liveTime}
        </div>

        <div className="hero-live-map-header">
          <h1 className="hero-live-map-title">
            Kathmandu is{' '}
            <span className="hero-title-accent">Alive!</span>
          </h1>
          <p className="hero-live-map-subtitle">
            Discover concerts, comedy, festivals, sports, nightlife, and local events happening near you.
          </p>
        </div>

        {/* Category chips — hidden on small screens */}
        <div className="hero-category-chips" aria-label="Event categories">
          {CATEGORIES.map(({ label, value, Icon }) => (
            <button
              key={value}
              className={`hero-category-chip${selectedCategory === value ? ' active' : ''}`}
              type="button"
              onClick={() => setSelectedCategory(value)}
              aria-pressed={selectedCategory === value}
            >
              <Icon size={13} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        <div className="hero-live-status">
          <span className="status-dot" />
          <span>
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            {maxDistance ? ` within ${maxDistance} km` : ' live near you'}
          </span>
        </div>

      </div>
    </section>
  )
}
