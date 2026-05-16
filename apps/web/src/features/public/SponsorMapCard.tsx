import { Megaphone } from 'lucide-react'

export function SponsorMapCard() {
  return (
    <div className="hero-map-sponsor-card">
      <div className="sponsor-card-badge">
        <Megaphone size={14} />
        <span>Featured Zone</span>
      </div>
      <h3 className="sponsor-card-title">Thamel Tonight</h3>
      <p className="sponsor-card-subtitle">Promote your event here</p>
      <button
        className="sponsor-card-cta"
        type="button"
        aria-label="Boost your event"
      >
        Boost your event
      </button>
    </div>
  )
}
