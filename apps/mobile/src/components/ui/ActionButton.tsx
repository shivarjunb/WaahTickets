import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

export function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  loading = false
}: {
  label: string
  onPress: () => void
  secondary?: boolean
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.btn, secondary ? styles.btnSecondary : null, disabled ? styles.btnDisabled : null]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? '#9a3412' : '#fff7ed'} size="small" />
      ) : (
        <Text style={[styles.label, secondary ? styles.labelSecondary : null]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316'
  },
  btnSecondary: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74'
  },
  btnDisabled: { opacity: 0.6 },
  label: { color: '#fff7ed', fontSize: 14, fontWeight: '800' },
  labelSecondary: { color: '#9a3412' }
})
