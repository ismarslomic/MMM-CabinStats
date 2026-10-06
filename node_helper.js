/*! *****************************************************************************
  mmm-cabinstats
  Version 1.0.0

  MagicMirror module showing live cabin visit stats and fun facts
  Please submit bugs at https://github.com/ismarslomic/MMM-CabinStats/issues

  (c) ismar@slomic.no
  Licence: MIT

  This file is auto-generated. Do not edit.
***************************************************************************** */
'use strict';

var NodeHelper = require('node_helper');
var Log = require('logger');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var Log__namespace = /*#__PURE__*/_interopNamespaceDefault(Log);

var SocketNotification;
(function (SocketNotification) {
    SocketNotification["LIVE_STATS_REQUEST"] = "LIVE_STATS_REQUEST";
    SocketNotification["LIVE_STATS_RESPONSE"] = "LIVE_STATS_RESPONSE";
    SocketNotification["LIVE_STATS_ERROR"] = "LIVE_STATS_ERROR";
    // Hello World leftovers, removed together with Greetings.ts when the frontend is ported (phase 4).
    SocketNotification["GREETINGS_TEXT_REQUEST"] = "GREETINGS_TEXT_REQUEST";
    SocketNotification["GREETINGS_TEXT_RESPONSE"] = "GREETINGS_TEXT_RESPONSE";
})(SocketNotification || (SocketNotification = {}));

/** JavaScript timers use a signed 32-bit delay; larger values overflow. */
const maximumTimerDelay = 2 ** 31 - 1;
/** Defaults of every option except `apiBaseUrl`, which is required and has no default. */
const defaultConfig = {
    updateInterval: 600_000,
    requestTimeout: 10_000,
    guestFactInterval: 18_000,
    cabinFactInterval: 45_000,
    showNextVisit: true,
    showCabinFacts: true,
    pauseWhenHidden: false,
    animationSpeed: 1_000,
};
/**
 * Normalises `apiBaseUrl`: trims whitespace and trailing slashes. Returns `undefined` when the value is missing,
 * not a string, or not an absolute `http` or `https` url.
 */
function normaliseApiBaseUrl(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim().replace(/\/+$/, '');
    try {
        const { protocol } = new URL(trimmed);
        return protocol === 'http:' || protocol === 'https:' ? trimmed : undefined;
    }
    catch {
        return undefined;
    }
}
function positiveTimerDelay(value, fallback) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maximumTimerDelay
        ? value
        : fallback;
}
function nonNegativeInteger(value, fallback) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}
function boolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
/**
 * Validates and normalises the config of a module instance. Invalid values fall back to {@link defaultConfig}; an
 * invalid or missing `apiBaseUrl` stays `undefined` so callers can show the config error and skip fetching.
 */
function resolveConfig(raw) {
    const config = typeof raw === 'object' && raw !== null ? { ...raw } : {};
    return {
        apiBaseUrl: normaliseApiBaseUrl(config.apiBaseUrl),
        updateInterval: positiveTimerDelay(config.updateInterval, defaultConfig.updateInterval),
        requestTimeout: positiveTimerDelay(config.requestTimeout, defaultConfig.requestTimeout),
        guestFactInterval: positiveTimerDelay(config.guestFactInterval, defaultConfig.guestFactInterval),
        cabinFactInterval: positiveTimerDelay(config.cabinFactInterval, defaultConfig.cabinFactInterval),
        showNextVisit: boolean(config.showNextVisit, defaultConfig.showNextVisit),
        showCabinFacts: boolean(config.showCabinFacts, defaultConfig.showCabinFacts),
        pauseWhenHidden: boolean(config.pauseWhenHidden, defaultConfig.pauseWhenHidden),
        animationSpeed: nonNegativeInteger(config.animationSpeed, defaultConfig.animationSpeed),
    };
}
/** Type guard for a config that has a usable `apiBaseUrl`. */
function hasApiBaseUrl(config) {
    return config.apiBaseUrl !== undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isRecord$1(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isString(value) {
    return typeof value === 'string';
}
/** `YYYY-MM-DD` that is also a real calendar date (rejects `2026-02-31`). */
function isIsoDate(value) {
    if (!isString(value) || !ISO_DATE.test(value))
        return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
/** The backend sends explicit `null` for absent values, but the spec leaves them out of `required`. */
function isOptional(value, isValid) {
    return value === undefined || value === null || isValid(value);
}
function isArrayOf(value, isValid) {
    return Array.isArray(value) && value.every(isValid);
}
function isGuestPeriodStats(value) {
    return (isRecord$1(value) &&
        isNumber(value.totalVisits) &&
        isNumber(value.totalDays) &&
        isOptional(value.visitsRank, isNumber) &&
        isOptional(value.daysRank, isNumber));
}
function isLiveGuestStats(value) {
    return (isRecord$1(value) &&
        isString(value.guestId) &&
        isString(value.firstName) &&
        isString(value.lastName) &&
        isNumber(value.age) &&
        typeof value.isFamily === 'boolean' &&
        isOptional(value.avatarUrl, isString) &&
        typeof value.isFirstVisit === 'boolean' &&
        isOptional(value.firstVisitDate, isIsoDate) &&
        isOptional(value.lastVisitDate, isIsoDate) &&
        isArrayOf(value.yearsVisited, isNumber) &&
        isGuestPeriodStats(value.currentYear) &&
        isGuestPeriodStats(value.allTime));
}
function isCurrentReservation(value) {
    return (isRecord$1(value) &&
        isIsoDate(value.startDate) &&
        isIsoDate(value.endDate) &&
        isArrayOf(value.guests, isLiveGuestStats) &&
        isNumber(value.remainingNights));
}
function isNextReservation(value) {
    return (isRecord$1(value) &&
        isIsoDate(value.startDate) &&
        isIsoDate(value.endDate) &&
        isArrayOf(value.guests, isLiveGuestStats) &&
        isNumber(value.daysUntil));
}
function isFunFact(value) {
    return isRecord$1(value) && isOptional(value.guestId, isString) && isString(value.text) && isNumber(value.priority);
}
/**
 * Type guard for {@link LiveStats}. The payload crosses a runtime boundary (backend response), which TypeScript
 * cannot validate. Every field the module reads is checked. Nullable fields accept `null` and a missing key.
 */
function isLiveStats(payload) {
    return (isRecord$1(payload) &&
        typeof payload.isOccupied === 'boolean' &&
        isOptional(payload.currentReservation, isCurrentReservation) &&
        isOptional(payload.nextReservation, isNextReservation) &&
        isNumber(payload.allTimeVisits) &&
        isNumber(payload.allTimeNights) &&
        isNumber(payload.allTimeUniqueGuests) &&
        isArrayOf(payload.guestFunFacts, isFunFact) &&
        isArrayOf(payload.cabinFunFacts, isFunFact) &&
        isArrayOf(payload.nextVisitFunFacts, isFunFact));
}

function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
/**
 * Type guard for {@link LiveStatsRequest}. Only `identifier` and the presence of a `config` object are checked;
 * the config content is validated by `resolveConfig`.
 */
function isLiveStatsRequest(payload) {
    return isRecord(payload) && typeof payload.identifier === 'string' && isRecord(payload.config);
}

/**
 * Fetches `GET /api/stats` from the backend and validates the response.
 *
 * @throws Error with a short description on network failure, timeout, non-2xx status, invalid JSON or a payload
 * that does not match the contract.
 */
async function fetchLiveStats({ apiBaseUrl, requestTimeout }, fetchFn = fetch) {
    const url = `${apiBaseUrl}/api/stats`;
    let response;
    try {
        response = await fetchFn(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(requestTimeout),
        });
    }
    catch (error) {
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        throw new Error(isTimeout ? `Request to ${url} timed out after ${requestTimeout} ms` : `Request to ${url} failed`, {
            cause: error,
        });
    }
    if (!response.ok) {
        throw new Error(`Request to ${url} failed with status ${response.status}`);
    }
    let body;
    try {
        body = await response.json();
    }
    catch (error) {
        throw new Error(`Response from ${url} is not valid JSON`, { cause: error });
    }
    if (!isLiveStats(body)) {
        throw new Error(`Response from ${url} does not match the expected live stats contract`);
    }
    return body;
}

// noinspection JSVoidFunctionReturnValueUsed,JSUnusedGlobalSymbols
// Default import preserves static methods on MagicMirror's CommonJS NodeHelper class.
var Backend = NodeHelper.create({
    start() {
        Log__namespace.debug(`${this.name} is started!`);
    },
    stop() {
        Log__namespace.debug(`${this.name} is stopped!`);
    },
    socketNotificationReceived(notification, request) {
        if (notification !== SocketNotification.LIVE_STATS_REQUEST) {
            Log__namespace.error(`${this.name} received unknown socket notification: '${notification}'`);
            return;
        }
        if (!isLiveStatsRequest(request)) {
            Log__namespace.error(`${this.name} received an invalid live stats request`);
            return;
        }
        void this.loadLiveStats(request.identifier, request.config);
    },
    async loadLiveStats(identifier, rawConfig) {
        const config = resolveConfig(rawConfig);
        if (!hasApiBaseUrl(config)) {
            this.sendError(identifier, 'apiBaseUrl is missing or not a valid http(s) url');
            return;
        }
        try {
            const liveStats = await fetchLiveStats(config);
            const payload = { identifier, liveStats, fetchedAt: Date.now() };
            this.sendSocketNotification(SocketNotification.LIVE_STATS_RESPONSE, payload);
        }
        catch (error) {
            this.sendError(identifier, error instanceof Error ? error.message : String(error));
        }
    },
    sendError(identifier, message) {
        Log__namespace.error(`${this.name} could not load live stats: ${message}`);
        const payload = { identifier, message };
        this.sendSocketNotification(SocketNotification.LIVE_STATS_ERROR, payload);
    },
});

module.exports = Backend;
//# sourceMappingURL=node_helper.js.map
