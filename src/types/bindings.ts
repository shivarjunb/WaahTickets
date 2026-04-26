export type Bindings = {
  DB: D1Database
  EMAIL_QUEUE?: Queue
  SENDGRID_API_KEY?: string
  EMAIL_FROM?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  AUTH_REDIRECT_ORIGIN?: string
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
}
