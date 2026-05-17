import { StyleSheet, Text, View } from 'react-native'

export function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  label: { color: '#64748b', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: '#0f172a', fontSize: 15, fontWeight: '700' }
})
