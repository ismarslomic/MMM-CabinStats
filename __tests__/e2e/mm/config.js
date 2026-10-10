const mockBackend = 'http://127.0.0.1:8081'

// Fast timers so the specs do not wait for the production defaults (10 minutes polling, 18 s rotation).
const fast = { animationSpeed: 0, guestFactInterval: 1000, cabinFactInterval: 1000 }

const config = {
  address: '127.0.0.1',
  port: 8080,
  ipWhitelist: ['127.0.0.1', '::1', '::ffff:127.0.0.1'],
  language: 'nb',
  locale: 'nb-NO',
  logLevel: ['INFO', 'LOG', 'WARN', 'ERROR'],
  modules: [
    {
      module: 'MMM-CabinStats',
      position: 'top_left',
      config: { ...fast, apiBaseUrl: `${mockBackend}/occupied-mixed` },
    },
    {
      module: 'MMM-CabinStats',
      position: 'top_right',
      config: { ...fast, apiBaseUrl: `${mockBackend}/not-occupied-next` },
    },
    {
      module: 'MMM-CabinStats',
      position: 'top_center',
      config: { ...fast },
    },
    {
      module: 'MMM-CabinStats',
      position: 'bottom_left',
      config: { ...fast, apiBaseUrl: `${mockBackend}/guest-without-avatar`, guestViewTimeout: 2000 },
    },
    {
      module: 'MMM-CabinStats',
      position: 'bottom_right',
      config: { ...fast, apiBaseUrl: `${mockBackend}/flaky`, updateInterval: 1000 },
    },
  ],
}

if (typeof module !== 'undefined') {
  module.exports = config
}
