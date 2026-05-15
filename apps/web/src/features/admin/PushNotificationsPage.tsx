import { useEffect, useRef, useState } from "react"
import { Bell, Send, RefreshCw } from "lucide-react"
import { fetchJson } from "../../shared/utils"
import type { ApiListResponse } from "../../shared/types"

type Campaign = {
  id: string
  title: string
  body: string
  event_id: string | null
  image_url: string | null
  audience_type: string
  audience_user_id: string | null
  status: string
  sent_at: string | null
  created_at: string
  created_by_email: string
  delivery_count: number
  delivered_count: number
  sample_error: string | null
}

type PublicEventRow = {
  id: string
  name: string
}

type UserOption = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

type SendResult = {
  ok: boolean
  campaign_id: string
  sent: number
  delivered: number
  failed: number
  failure_reasons?: string[]
}

function parseErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.message === "string") return parsed.message
    if (parsed.details && typeof (parsed.details as Record<string, unknown>).error === "string")
      return (parsed.details as Record<string, unknown>).error as string
  } catch {
    // not JSON
  }
  return raw
}

export function PushNotificationsPage() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [eventId, setEventId] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [audienceType, setAudienceType] = useState<"all" | "user">("all")
  const [audienceUserId, setAudienceUserId] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignsError, setCampaignsError] = useState("")

  const [events, setEvents] = useState<PublicEventRow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    void loadCampaigns()
    void loadEvents()
    void loadUsers()
  }, [])

  async function loadEvents() {
    try {
      // fetchJson returns { data: parsedJson, response }
      const { data } = await fetchJson<{ data: PublicEventRow[] }>("/api/public/events")
      setEvents(data.data ?? [])
    } catch {
      // Optional — don't block the page
    }
  }

  async function loadCampaigns() {
    setCampaignsLoading(true)
    setCampaignsError("")
    try {
      const { data } = await fetchJson<{ data: Campaign[]; meta: { limit: number; offset: number } }>(
        "/api/admin/push/campaigns?limit=20"
      )
      setCampaigns(data.data ?? [])
    } catch (err) {
      setCampaignsError(err instanceof Error ? err.message : "Failed to load campaigns.")
    } finally {
      setCampaignsLoading(false)
    }
  }

  async function loadUsers() {
    try {
      const { data } = await fetchJson<ApiListResponse>("/api/users?limit=1000")
      const rows = Array.isArray(data.data) ? data.data : []
      const mapped = rows
        .map((row) => ({
          id: String(row.id ?? ""),
          email: String(row.email ?? ""),
          first_name: row.first_name ? String(row.first_name) : null,
          last_name: row.last_name ? String(row.last_name) : null,
        }))
        .filter((row) => row.id && row.email)
      setUsers(mapped)
    } catch {
      setUsers([])
    }
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setSendError("Title and body are required.")
      return
    }
    if (audienceType === "user" && !audienceUserId) {
      setSendError("Select a registered user.")
      return
    }
    setIsSending(true)
    setSendError("")
    setSendResult(null)
    try {
      const { data } = await fetchJson<SendResult>("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          event_id: eventId || null,
          image_url: imageUrl.trim() || null,
          audience_type: audienceType,
          audience_user_id: audienceType === "user" ? audienceUserId : null,
        }),
      })
      setSendResult(data)
      setTitle("")
      setBody("")
      setEventId("")
      setImageUrl("")
      setAudienceType("all")
      setAudienceUserId("")
      void loadCampaigns()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send notification.")
    } finally {
      setIsSending(false)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—"
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="tw-grid tw-gap-6">
      {/* Compose */}
      <section className="admin-card settings-card">
        <div className="admin-card-header">
          <div>
            <h2>Send Push Notification</h2>
            <p>Compose and send a push notification to all registered devices.</p>
          </div>
          <Bell size={20} style={{ opacity: 0.4 }} />
        </div>

        <div className="settings-grid" style={{ maxWidth: 560 }}>
          <label>
            <span>Title</span>
            <input
              maxLength={100}
              placeholder="e.g. New Event in Thamel"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            <span>Body</span>
            <textarea
              maxLength={300}
              rows={3}
              placeholder="e.g. Tickets are now live. Tap to book before they sell out."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ resize: "vertical", padding: "8px 10px", minHeight: 72 }}
            />
          </label>

          <label>
            <span>
              Link to event{" "}
              <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
            </span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">No event — general notification</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>
              Image URL <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
            </span>
            <input
              type="url"
              placeholder="https://example.com/promo.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </label>

          <label>
            <span>Audience</span>
            <select value={audienceType} onChange={(e) => setAudienceType(e.target.value === "user" ? "user" : "all")}>
              <option value="all">All registered users</option>
              <option value="user">Single registered user</option>
            </select>
          </label>
          {audienceType === "user" ? (
            <label>
              <span>Registered user</span>
              <select value={audienceUserId} onChange={(e) => setAudienceUserId(e.target.value)}>
                <option value="">Select user</option>
                {users.map((user) => {
                  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
                  return (
                    <option key={user.id} value={user.id}>
                      {name ? `${name} (${user.email})` : user.email}
                    </option>
                  )
                })}
              </select>
            </label>
          ) : null}
        </div>

        {sendError ? (
          <div className="admin-table-alert" role="alert" style={{ marginTop: 12 }}>
            {sendError}
          </div>
        ) : null}

        {sendResult ? (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: sendResult.failed > 0 ? "rgba(234,179,8,0.1)" : "rgba(34,197,94,0.1)",
                border: `1px solid ${sendResult.failed > 0 ? "rgba(234,179,8,0.4)" : "rgba(34,197,94,0.3)"}`,
                fontSize: 13,
                color: sendResult.failed > 0 ? "#854d0e" : "#166534",
              }}
            >
              Sent to <strong>{sendResult.sent}</strong> device
              {sendResult.sent !== 1 ? "s" : ""} —{" "}
              <strong>{sendResult.delivered}</strong> delivered
              {sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}.
            </div>
            {sendResult.failure_reasons && sendResult.failure_reasons.length > 0 ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  fontSize: 12,
                  color: "#991b1b",
                }}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>Failure reason:</strong>
                {sendResult.failure_reasons.map((r, i) => (
                  <div key={i} style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {r}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <button
            className="primary-admin-button"
            type="button"
            disabled={isSending || !title.trim() || !body.trim()}
            onClick={() => void handleSend()}
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <Send size={15} />
            {isSending ? "Sending…" : "Send Now"}
          </button>
        </div>
      </section>

      {/* History */}
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Recent Campaigns</h2>
            <p>Last 20 notifications sent from the admin panel.</p>
          </div>
          <button
            type="button"
            title="Refresh"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: 0.5,
              padding: 4,
            }}
            onClick={() => void loadCampaigns()}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {campaignsLoading ? (
          <p style={{ opacity: 0.5, fontSize: 14 }}>Loading…</p>
        ) : campaignsError ? (
          <div className="admin-table-alert" role="alert">
            {campaignsError}
          </div>
        ) : campaigns.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: 14 }}>No campaigns sent yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Body</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th style={{ textAlign: "right" }}>Delivered</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{c.title}</td>
                    <td
                      style={{
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.body}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 9px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            c.status === "sent"
                              ? "rgba(34,197,94,0.12)"
                              : c.status === "failed"
                                ? "rgba(239,68,68,0.12)"
                                : "rgba(234,179,8,0.12)",
                          color:
                            c.status === "sent"
                              ? "#166534"
                              : c.status === "failed"
                                ? "#991b1b"
                                : "#854d0e",
                        }}
                      >
                        {c.status}
                      </span>
                      {c.sample_error ? (
                        <div
                          title={parseErrorMessage(c.sample_error)}
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: "#991b1b",
                            maxWidth: 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            cursor: "help",
                          }}
                        >
                          {parseErrorMessage(c.sample_error)}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ whiteSpace: "nowrap", opacity: 0.7 }}>
                      {formatDate(c.sent_at ?? c.created_at)}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {c.delivered_count} / {c.delivery_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
