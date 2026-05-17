import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PinConfig } from './MapPinAppearance'
import type { PopupField } from '../public/NepalMap'
import { EventMapPopup } from '../public/EventMapPopup'

const ICON_SVG_PATHS: Record<string, string> = {
  'Concert':      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'Food & Drink': '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  'Festival':     '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
  'Sports':       '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/><path d="M4 22h16"/>',
  'Comedy':       '<circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  'Nightlife':    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  'General':      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
}

interface MapWizardPreviewProps {
  lat: number | null
  lng: number | null
  pinConfig: PinConfig
  popupFields: PopupField[]
  eventTitle: string
  eventArea: string
  eventTime: string
  eventPrice: string
}

export function MapWizardPreview({
  lat, lng, pinConfig, popupFields, eventTitle, eventArea, eventTime, eventPrice,
}: MapWizardPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [showCard, setShowCard] = useState(false)

  const svgPath = ICON_SVG_PATHS[pinConfig.icon] ?? ICON_SVG_PATHS['General']
  const color = pinConfig.color

  const pinHtml = `
    <div class="map-leaflet-pin" style="--pin-color:${color}">
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const center: [number, number] = lat != null && lng != null ? [lat, lng] : [27.7172, 85.324]

    const map = L.map(containerRef.current, {
      center,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update marker when pin config or lat/lng changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }
    if (lat == null || lng == null) return

    map.setView([lat, lng], 15)
    const icon = L.divIcon({ className: '', html: pinHtml, iconSize: [40, 40], iconAnchor: [20, 20] })
    markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
  }, [lat, lng, pinConfig])

  return (
    <div className="map-wizard-step">
      <p className="map-wizard-hint">This is how your event will appear on the public map.</p>

      <div className="map-wizard-preview-layout">
        {/* Mini map */}
        <div style={{ position: 'relative' }}>
          <div ref={containerRef} className="map-wizard-preview-leaflet" />
          {/* Simulated hover button */}
          <button
            type="button"
            className="map-wizard-preview-hover-btn"
            onClick={() => setShowCard((v) => !v)}
          >
            {showCard ? 'Hide popup' : 'Preview popup'}
          </button>
        </div>

        {/* Popup card preview */}
        {showCard && (
          <div className="map-wizard-popup-preview">
            <EventMapPopup
              title={eventTitle || 'Your Event'}
              category={pinConfig.icon}
              area={eventArea || 'Kathmandu'}
              time={eventTime || 'Tonight, 8:00 PM'}
              priceFrom={eventPrice || 'Rs. 500'}
              sponsored={false}
              eventId="preview"
              categoryColor={color}
              popupConfig={popupFields}
              onViewDetails={() => {}}
            />
          </div>
        )}
      </div>

      {lat == null && (
        <p className="map-wizard-error">No location set — go back to Step 1 to place your pin.</p>
      )}
    </div>
  )
}
