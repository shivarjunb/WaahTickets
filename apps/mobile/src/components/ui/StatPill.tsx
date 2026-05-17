import { StyleSheet, Text, View } from 'react-native'

export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: { flex: 1, borderRadius: 18, padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', gap: 4 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: '#f8fafc', fontSize: 13, fontWeight: '700' }
})
