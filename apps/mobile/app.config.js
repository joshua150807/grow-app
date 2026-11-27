// Keep the existing app identity and the beta runtime unchanged.
module.exports = ({ config }) => process.env.EAS_BUILD_PROFILE === 'training-v2-internal'
  ? { ...config, runtimeVersion: 'training-v2-internal-1.0.8' }
  : config;
