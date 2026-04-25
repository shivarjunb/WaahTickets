import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const featuredEvents = [
  {
    date: 'May 18',
    title: 'Neon Rooftop Sessions',
    venue: 'Skyline Hall',
    price: '$42'
  },
  {
    date: 'Jun 02',
    title: 'Founders Comedy Night',
    venue: 'The Exchange',
    price: '$28'
  },
  {
    date: 'Jun 21',
    title: 'Summer Food & Sound Fest',
    venue: 'Riverfront Yard',
    price: '$35'
  }
]

const stats = [
  ['18k+', 'tickets issued'],
  ['42', 'live events'],
  ['4.9', 'guest rating']
]

function App() {
  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>Waahtickets</span>
        </a>
        <div className="nav-links">
          <a href="#events">Events</a>
          <a href="#insights">Insights</a>
          <a href="#checkout">Checkout</a>
        </div>
        <a className="nav-action" href="#events">
          Explore
        </a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Event ticketing starter</p>
          <h1>Sell out the room without slowing down the line.</h1>
          <p className="hero-text">
            Waahtickets gives organizers a crisp starting point for event discovery,
            seatless tickets, guest check-in, and fast mobile checkout.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#events">
              Browse events
            </a>
            <a className="secondary-button" href="#checkout">
              View checkout
            </a>
          </div>
        </div>

        <div className="event-preview" aria-label="Featured ticket preview">
          <div className="ticket">
            <div className="ticket-header">
              <span>Tonight</span>
              <strong>Admit 2</strong>
            </div>
            <div>
              <p className="ticket-kicker">Live at Meridian Room</p>
              <h2>Midnight Market Live</h2>
            </div>
            <div className="ticket-grid">
              <span>Gate</span>
              <strong>B7</strong>
              <span>Doors</span>
              <strong>8:30 PM</strong>
              <span>Order</span>
              <strong>#WAH-2048</strong>
            </div>
            <div className="scan-row">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <section className="stats-row" id="insights" aria-label="Waahtickets metrics">
        {stats.map(([value, label]) => (
          <div className="stat" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel events-panel" id="events">
          <div className="section-heading">
            <p className="eyebrow">Featured drops</p>
            <h2>Upcoming events</h2>
          </div>
          <div className="event-list">
            {featuredEvents.map((event) => (
              <article className="event-card" key={event.title}>
                <div className="event-date">{event.date}</div>
                <div>
                  <h3>{event.title}</h3>
                  <p>{event.venue}</p>
                </div>
                <strong>{event.price}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="panel checkout-panel" id="checkout">
          <div className="section-heading">
            <p className="eyebrow">Fast checkout</p>
            <h2>Ready for tap, scan, and send.</h2>
          </div>
          <div className="checkout-stack">
            <div className="checkout-line">
              <span>General admission</span>
              <strong>$70.00</strong>
            </div>
            <div className="checkout-line">
              <span>Service fee</span>
              <strong>$4.80</strong>
            </div>
            <div className="checkout-total">
              <span>Total</span>
              <strong>$74.80</strong>
            </div>
          </div>
          <button type="button">Reserve tickets</button>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
