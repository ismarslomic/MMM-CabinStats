export enum SocketNotification {
  LIVE_STATS_REQUEST = 'LIVE_STATS_REQUEST',
  LIVE_STATS_RESPONSE = 'LIVE_STATS_RESPONSE',
  LIVE_STATS_ERROR = 'LIVE_STATS_ERROR',
  // Hello World leftovers, removed together with Greetings.ts when the frontend is ported (phase 4).
  GREETINGS_TEXT_REQUEST = 'GREETINGS_TEXT_REQUEST',
  GREETINGS_TEXT_RESPONSE = 'GREETINGS_TEXT_RESPONSE',
}
