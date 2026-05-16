import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, MapPin, Navigation } from 'lucide-react'

interface MapLocationPickerProps {
  lat: number | null
  lng: number | null
  eventAddress?: string
  onChange: (lat: number, lng: number) => void
}

type NominatimResult = { lat: string; lon: string; display_name: string }

const KATHMANDU: [number, number] = [27.7172, 85.324]

function buildPinHtml(): string {
  return `<div style="
    width:34px;height:34px;border-radius:50%;
    background:#e91e63;display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 2px rgba(255,255,255,0.2),0 4px 14px rgba(0,0,0,0.5),0 0 18px rgba(233,30,99,0.5);
    cursor:grab;
  ">
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="white" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`
}

export function MapLocationPicker({ lat, lng, eventAddress, onChange }: MapLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // ── Shared pin placement ──────────────────────────────────────────────────
  const placePin = useCallback((newLat: number, newLng: number) => {
    const map = mapRef.current
    if (!map) return
    map.setView([newLat, newLng], 16)
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng])
    } else {
      const icon = L.divIcon({ className: '', html: buildPinHtml(), iconSize: [34, 34], iconAnchor: [17, 17] })
      markerRef.current = L.marker([newLat, newLng], { icon, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng()
        onChange(pos.lat, pos.lng)
      })
    }
    onChange(newLat, newLng)
  }, [onChange])

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: lat != null && lng != null ? [lat, lng] : KATHMANDU,
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    if (lat != null && lng != null) {
      const icon = L.divIcon({ className: '', html: buildPinHtml(), iconSize: [34, 34], iconAnchor: [17, 17] })
      markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng()
        onChange(pos.lat, pos.lng)
      })
    }

    map.on('click', (e) => {
      placePin(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typeahead fetch ───────────────────────────────────────────────────────
  function handleInput(value: string) {
    setSearchQuery(value)
    setSearchError('')
    setHighlightedIndex(-1)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&countrycodes=np`
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
        const data = await res.json() as NominatimResult[]
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  // ── Select a suggestion ───────────────────────────────────────────────────
  function selectSuggestion(result: NominatimResult) {
    // Show only the first meaningful part in the input
    const shortName = result.display_name.split(',')[0].trim()
    setSearchQuery(shortName)
    setShowSuggestions(false)
    setSuggestions([])
    setHighlightedIndex(-1)
    placePin(parseFloat(result.lat), parseFloat(result.lon))
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      if (e.key === 'Enter' && searchQuery.trim()) runSearch(searchQuery)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0) selectSuggestion(suggestions[highlightedIndex])
      else if (suggestions.length > 0) selectSuggestion(suggestions[0])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // ── Fallback full search (Search button / Enter with no highlight) ─────────
  async function runSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsSearching(true)
    setSearchError('')
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=np`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json() as NominatimResult[]
      if (!data.length) { setSearchError('No results found — try a different address'); return }
      selectSuggestion(data[0])
    } catch {
      setSearchError('Geocoding failed — check your connection')
    } finally {
      setIsSearching(false)
    }
  }

  // Split display_name into primary label + context
  function parseName(display_name: string): { name: string; address: string } {
    const parts = display_name.split(',')
    return {
      name: parts[0].trim(),
      address: parts.slice(1, 3).join(',').trim(),
    }
  }

  return (
    <div className="map-wizard-step">
      <p className="map-wizard-hint">
        <MapPin size={14} /> Click anywhere on the map to place your event pin, or search for an address.
      </p>

      {/* Search row */}
      <div className="map-wizard-search-row">
        {/* Combobox wrapper so the dropdown is positioned relative to the input */}
        <div className="map-wizard-search-combobox">
          <div className="map-wizard-search-input-wrap">
            <Search size={14} className="map-wizard-search-icon" />
            <input
              className="map-wizard-search-input"
              placeholder="Search address, venue, area…"
              value={searchQuery}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => {
                // Delay so mousedown on a suggestion fires before blur hides the list
                setTimeout(() => setShowSuggestions(false), 150)
              }}
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
            />
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="map-location-suggestions" role="listbox">
              {suggestions.map((result, i) => {
                const { name, address } = parseName(result.display_name)
                return (
                  <button
                    key={i}
                    type="button"
                    className={`map-location-suggestion-item${i === highlightedIndex ? ' highlighted' : ''}`}
                    onMouseDown={() => selectSuggestion(result)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    role="option"
                    aria-selected={i === highlightedIndex}
                  >
                    <MapPin size={13} className="map-location-suggestion-icon" />
                    <div>
                      <div className="map-location-suggestion-name">{name}</div>
                      {address && <div className="map-location-suggestion-address">{address}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {eventAddress && (
          <button
            className="map-wizard-btn map-wizard-btn--ghost"
            type="button"
            title="Auto-geocode the event's venue address"
            onClick={() => { setSearchQuery(eventAddress); runSearch(eventAddress) }}
          >
            <Navigation size={13} /> Use event address
          </button>
        )}
      </div>

      {searchError && <p className="map-wizard-error">{searchError}</p>}

      {/* Leaflet map */}
      <div ref={containerRef} className="map-wizard-leaflet" />

      {/* Coordinate readout */}
      <div className="map-wizard-coord-row">
        <label className="map-wizard-coord-label">
          Latitude
          <input
            className="map-wizard-coord-input"
            type="number"
            step="0.0001"
            value={lat ?? ''}
            placeholder="27.7172"
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) onChange(v, lng ?? 85.324)
            }}
          />
        </label>
        <label className="map-wizard-coord-label">
          Longitude
          <input
            className="map-wizard-coord-input"
            type="number"
            step="0.0001"
            value={lng ?? ''}
            placeholder="85.3240"
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) onChange(lat ?? 27.7172, v)
            }}
          />
        </label>
      </div>
    </div>
  )
}
