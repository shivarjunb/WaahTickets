// Expo SDK 55 / RN 0.83 generates MainApplication.kt that doesn't implement
// the abstract `val reactNativeHost` from ReactApplication. This plugin adds
// the required stub so the Android build compiles.
const { withMainApplication } = require('@expo/config-plugins')

const withMainApplicationFix = (config) => {
  return withMainApplication(config, (config) => {
    if (config.modResults.contents.includes('override val reactNativeHost')) {
      return config
    }
    config.modResults.contents = config.modResults.contents.replace(
      /class MainApplication : Application\(\), ReactApplication \{/,
      `class MainApplication : Application(), ReactApplication {

  @Suppress("DEPRECATION")
  override val reactNativeHost: com.facebook.react.ReactNativeHost
    get() = throw UnsupportedOperationException("New Architecture enabled — use reactHost.")`
    )
    return config
  })
}

module.exports = withMainApplicationFix
