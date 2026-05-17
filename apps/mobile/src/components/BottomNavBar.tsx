import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MobileView } from '../types'
import { AppIcon } from './AppIcon'

type Tab = {
  view: MobileView
  label: string
  icon: 'home' | 'search' | 'scan' | 'tickets' | 'account'
}

const TABS: Tab[] = [
  { view: 'home',      label: 'Home',    icon: 'home'    },
  { view: 'search',    label: 'Search',  icon: 'search'  },
  { view: 'validator', label: 'Validate', icon: 'scan'   },
  { view: 'tickets',   label: 'Orders',  icon: 'tickets' },
  { view: 'account',   label: 'Profile', icon: 'account' },
]

export function BottomNavBar({
  activeView,
  cartCount,
  validatorAllowed,
  bottomInset,
  onSelect
}: {
  activeView: MobileView
  cartCount: number
  validatorAllowed: boolean
  bottomInset: number
  onSelect: (view: MobileView) => void
}) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map((tab) => {
        const isCenter = tab.view === 'validator'
        const isActive = activeView === tab.view

        if (isCenter) {
          return (
            <Pressable
              key={tab.view}
              onPress={() => onSelect(tab.view)}
              style={styles.centerTabWrapper}
            >
              <View style={[styles.centerCircle, isActive && styles.centerCircleActive]}>
                <AppIcon name="scan" color="#ffffff" size={24} />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          )
        }

        return (
          <Pressable
            key={tab.view}
            onPress={() => onSelect(tab.view)}
            style={styles.tab}
          >
            {tab.view === 'tickets' && cartCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : String(cartCount)}</Text>
              </View>
            ) : null}
            <AppIcon
              name={tab.icon}
              color={isActive ? '#f4317f' : '#64748b'}
              size={22}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
    position: 'relative',
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    gap: 3,
  },
  centerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#f4317f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#0b1220',
  },
  centerCircleActive: {
    backgroundColor: '#f4317f',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: '20%',
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  badgeText: { color: '#fff7ed', fontSize: 10, fontWeight: '800' },
  label: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  labelActive: { color: '#f4317f' },
})
