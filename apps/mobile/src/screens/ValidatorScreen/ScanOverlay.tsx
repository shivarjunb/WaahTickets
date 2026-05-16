import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView } from 'expo-camera'
import { AppIcon } from '../../components/AppIcon'

const SCREEN_WIDTH = Dimensions.get('window').width
const ZONE_SIZE = Math.min(SCREEN_WIDTH * 0.68, 280)
const BRACKET = 28
const BRACKET_THICKNESS = 3

export function ScanOverlay({
  onBarcodeScanned,
  onBack,
  scanning
}: {
  onBarcodeScanned: (data: string) => void
  onBack: () => void
  scanning: boolean
}) {
  const scanLineY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!scanning) {
      scanLineY.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: ZONE_SIZE, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 1800, useNativeDriver: true })
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [scanning, scanLineY])

  return (
    <View style={styles.container}>
      {scanning ? (
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={({ data }) => { if (data) onBarcodeScanned(data) }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.idleBg]} />
      )}

      {/* dark overlay outside scan zone */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* scan zone cutout — clear center */}
      <View style={styles.zoneWrapper} pointerEvents="none">
        <View style={styles.zone}>
          {/* corner brackets */}
          <View style={[styles.bracket, styles.bracketTL]} />
          <View style={[styles.bracket, styles.bracketTR]} />
          <View style={[styles.bracket, styles.bracketBL]} />
          <View style={[styles.bracket, styles.bracketBR]} />

          {/* scan line */}
          {scanning ? (
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
            />
          ) : null}
        </View>

        <Text style={styles.hint}>
          {scanning ? 'Point at a ticket QR code' : 'Press Start to begin scanning'}
        </Text>
      </View>

      {/* top bar */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={onBack} style={styles.iconBtn}>
          <AppIcon name="back" color="#ffffff" size={26} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Text style={styles.topBarText}>Scan Ticket</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  idleBg: { backgroundColor: '#0b1220' },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  zoneWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  zone: {
    width: ZONE_SIZE,
    height: ZONE_SIZE,
    position: 'relative',
  },

  // corner brackets
  bracket: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
  },
  bracketTL: {
    top: 0, left: 0,
    borderTopWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
    borderColor: '#ffffff',
    borderTopLeftRadius: 4,
  },
  bracketTR: {
    top: 0, right: 0,
    borderTopWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
    borderColor: '#ffffff',
    borderTopRightRadius: 4,
  },
  bracketBL: {
    bottom: 0, left: 0,
    borderBottomWidth: BRACKET_THICKNESS,
    borderLeftWidth: BRACKET_THICKNESS,
    borderColor: '#ffffff',
    borderBottomLeftRadius: 4,
  },
  bracketBR: {
    bottom: 0, right: 0,
    borderBottomWidth: BRACKET_THICKNESS,
    borderRightWidth: BRACKET_THICKNESS,
    borderColor: '#ffffff',
    borderBottomRightRadius: 4,
  },

  // scan line
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#f4317f',
    shadowColor: '#f4317f',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { flex: 1, alignItems: 'center' },
  topBarText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
})
