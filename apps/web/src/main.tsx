import React, { StrictMode, useEffect, useState, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ReportsApp, isReportsRoute } from './reports'
import './styles.css'
import type { ButtonColorTheme, AuthUser } from "./shared/types";
import { defaultButtonColorTheme } from "./shared/constants";
import { loadButtonColorTheme, applyButtonThemeToDocument, fetchJson, hasAdminConsoleAccess } from "./shared/utils";
import { AuthModal, LoginRequired, AccountAccessBlocked } from "./shared/components/Auth";

// Lazy-loaded feature modules
const PublicApp = lazy(() => import('./features/public/PublicApp'));
const AdminApp = lazy(() => import('./features/admin/AdminApp'));
const TicketValidatorApp = lazy(() => import('./features/validator/TicketValidatorApp'));

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [user, setUser] = useState<AuthUser>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [buttonColorTheme, setButtonColorTheme] = useState<ButtonColorTheme>(() => loadButtonColorTheme())

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.body.dataset.theme = 'light'
    window.localStorage.removeItem('waah_theme')
  }, [])

  useEffect(() => {
    applyButtonThemeToDocument(buttonColorTheme)
    window.localStorage.setItem('waah_button_theme', JSON.stringify(buttonColorTheme))
  }, [buttonColorTheme])

  useEffect(() => {
    async function loadSession() {
      try {
        const { data } = await fetchJson<{ user: AuthUser }>('/api/auth/me')
        setUser(data.user)
      } catch {
        setUser(null)
      } finally {
        setIsAuthLoading(false)
      }
    }

    void loadSession()
  }, [])

  async function logout() {
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    } catch {
      // Clear client-side session even if the server has already expired it.
    }

    setUser(null)
    if (window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/')
      setPath('/')
    }
  }

  function navigate(nextPath: string) {
    const targetPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
    if (window.location.pathname === targetPath) return
    window.history.pushState({}, '', targetPath)
    setPath(window.location.pathname)
  }

  const isValidatorRoute = path === '/admin/validator' || path.startsWith('/admin/validator/')
  const isTicketVerifyRoute = path === '/ticket/verify'
  const isReportsView = isReportsRoute(path)
  const canAccessValidator =
    user?.webrole === 'Admin' || user?.webrole === 'Organizations' || user?.webrole === 'TicketValidator'
  const qrVerifyToken = isTicketVerifyRoute ? new URLSearchParams(window.location.search).get('token') : null

  return (
    <Suspense fallback={<div className="auth-gate"><section className="auth-gate-panel admin-loading-panel" aria-label="Loading"><div className="thin-spinner" role="status" aria-label="Loading" /></section></div>}>
      {isReportsView ? (
        isAuthLoading ? (
          <main className="auth-gate">
            <section className="auth-gate-panel admin-loading-panel" aria-label="Loading reports">
              <div className="thin-spinner" role="status" aria-label="Loading" />
            </section>
          </main>
        ) : user ? (
          user.is_active === false || !user.is_email_verified ? (
            <AccountAccessBlocked user={user} onLogout={logout} />
          ) : (
            <ReportsApp currentPath={path} user={user} onNavigate={navigate} onLogout={logout} />
          )
        ) : (
          <LoginRequired onLoginClick={() => setIsAuthOpen(true)} />
        )
      ) : path.startsWith('/admin') ? (
        isAuthLoading ? (
          <main className="auth-gate">
            <section className="auth-gate-panel admin-loading-panel" aria-label="Loading admin dashboard">
              <div className="thin-spinner" role="status" aria-label="Loading" />
            </section>
          </main>
        ) : user ? (
          user.is_active === false || !user.is_email_verified ? (
            <AccountAccessBlocked user={user} onLogout={logout} />
          ) : isValidatorRoute && canAccessValidator ? (
            <TicketValidatorApp
              initialQrToken={null}
              user={user}
              onLogout={logout}
            />
          ) : (
            <AdminApp
              user={user}
              onLoginClick={() => setIsAuthOpen(true)}
              onLogout={logout}
              buttonColorTheme={buttonColorTheme}
              onButtonColorThemeChange={setButtonColorTheme}
            />
          )
        ) : (
          <LoginRequired onLoginClick={() => setIsAuthOpen(true)} />
        )
      ) : (
        isTicketVerifyRoute && user && canAccessValidator ? (
          <TicketValidatorApp
            initialQrToken={qrVerifyToken}
            user={user}
            onLogout={logout}
          />
        ) : (
          <PublicApp
            currentPath={path}
            qrVerifyToken={isTicketVerifyRoute ? qrVerifyToken : null}
            user={user}
            isAuthLoading={isAuthLoading}
            onNavigate={navigate}
            onLoginClick={() => setIsAuthOpen(true)}
            onLogout={logout}
          />
        )
      )}
      {isAuthOpen ? (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onAuthenticated={(nextUser) => {
            setUser(nextUser)
            setIsAuthOpen(false)
            if (hasAdminConsoleAccess(nextUser) && !window.location.pathname.startsWith('/admin')) {
              navigate('/admin')
            }
          }}
        />
      ) : null}
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
