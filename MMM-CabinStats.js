/*! *****************************************************************************
  mmm-cabinstats
  Version 1.0.0

  MagicMirror module showing live cabin visit stats and fun facts
  Please submit bugs at https://github.com/ismarslomic/MMM-CabinStats/issues

  (c) ismar@slomic.no
  Licence: MIT

  This file is auto-generated. Do not edit.
***************************************************************************** */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('logger')) :
    typeof define === 'function' && define.amd ? define(['logger'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Log));
})(this, (function (Log) { 'use strict';

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

    const displays = ['full', 'stats', 'facts'];
    /** JavaScript timers use a signed 32-bit delay; larger values overflow. */
    const maximumTimerDelay = 2 ** 31 - 1;
    /** Defaults of every option except `apiBaseUrl`, which is required and has no default. */
    const defaultConfig = {
        apiBaseUrl: undefined,
        updateInterval: 600_000,
        requestTimeout: 10_000,
        guestFactInterval: 18_000,
        cabinFactInterval: 45_000,
        display: 'full',
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
    function oneOf(value, allowed, fallback) {
        return allowed.find((option) => option === value) ?? fallback;
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
            display: oneOf(config.display, displays, defaultConfig.display),
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

    var SocketNotification;
    (function (SocketNotification) {
        SocketNotification["LIVE_STATS_REQUEST"] = "LIVE_STATS_REQUEST";
        SocketNotification["LIVE_STATS_RESPONSE"] = "LIVE_STATS_RESPONSE";
        SocketNotification["LIVE_STATS_ERROR"] = "LIVE_STATS_ERROR";
    })(SocketNotification || (SocketNotification = {}));

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
    /** Type guard for {@link LiveStatsResponse}: string `identifier`, finite `fetchedAt` and a valid `liveStats`. */
    function isLiveStatsResponse(payload) {
        return (isRecord(payload) &&
            typeof payload.identifier === 'string' &&
            typeof payload.fetchedAt === 'number' &&
            Number.isFinite(payload.fetchedAt) &&
            isLiveStats(payload.liveStats));
    }
    /** Type guard for {@link LiveStatsError}. */
    function isLiveStatsError(payload) {
        return isRecord(payload) && typeof payload.identifier === 'string' && typeof payload.message === 'string';
    }

    /**
     * Initials for the avatar fallback: first letter of the first and last name, upper-cased. Uses code points so
     * names starting with a non-BMP character are not split. Returns `?` when both names are blank.
     */
    function initials(firstName, lastName) {
        const letters = [firstName, lastName]
            .map((name) => Array.from(name.trim())[0])
            .filter((letter) => letter !== undefined)
            .map((letter) => letter.toLocaleUpperCase('nb'));
        return letters.length > 0 ? letters.join('') : '?';
    }

    /**
     * Orders guest facts for rotation: round-robin between the guests, so every guest gets a turn before anyone gets a
     * second one. Facts without a `guestId` (about the whole group) take part as one more "guest". The order the backend
     * sorted them in (priority, descending) is kept within each guest, and first appearance decides the order between
     * guests.
     */
    function interleaveGuestFacts(facts) {
        const queues = new Map();
        for (const fact of facts) {
            const key = fact.guestId ?? null;
            const queue = queues.get(key);
            if (queue)
                queue.push(fact);
            else
                queues.set(key, [fact]);
        }
        const result = [];
        const lists = [...queues.values()];
        for (let round = 0; result.length < facts.length; round++) {
            for (const list of lists) {
                if (round < list.length)
                    result.push(list[round]);
            }
        }
        return result;
    }
    /** Index of the next fact, wrapping around. `0` for an empty list. */
    function nextIndex(index, length) {
        return length > 0 ? (index + 1) % length : 0;
    }
    /** Keeps `index` inside `[0, length - 1]`, e.g. after the list got shorter. `0` for an empty list. */
    function clampIndex(index, length) {
        return length > 0 ? Math.max(0, Math.min(index, length - 1)) : 0;
    }

    const emptyViewModel = (view, display, animationSpeed) => ({
        view,
        display,
        stay: null,
        guests: [],
        guestFact: null,
        cabinFact: null,
        nextVisit: null,
        totals: null,
        animationSpeed,
    });
    /** Joins the base url with the relative avatar url from the backend. `null` when either is missing. */
    function avatarUrlFor(apiBaseUrl, avatarUrl) {
        if (!apiBaseUrl || !avatarUrl)
            return null;
        return `${apiBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
    }
    function toGuestView(guest, apiBaseUrl) {
        return {
            guestId: guest.guestId,
            firstName: guest.firstName,
            avatarUrl: avatarUrlFor(apiBaseUrl, guest.avatarUrl),
            initials: initials(guest.firstName, guest.lastName),
            isFirstVisit: guest.isFirstVisit,
            isTopVisitor: guest.allTime.visitsRank === 1,
            visitNumber: guest.allTime.totalVisits,
        };
    }
    /** Builds the template data from the config, the latest stats and the rotation indices. */
    function buildViewModel({ config, liveStats, guestFactIndex, cabinFactIndex }) {
        const { animationSpeed, display } = config;
        const apiBaseUrl = normaliseApiBaseUrl(config.apiBaseUrl);
        if (apiBaseUrl === undefined)
            return emptyViewModel('config-error', display, animationSpeed);
        if (liveStats === undefined)
            return emptyViewModel('empty', display, animationSpeed);
        const current = liveStats.isOccupied ? liveStats.currentReservation : null;
        const next = config.showNextVisit ? liveStats.nextReservation : null;
        const guestFacts = current && display !== 'stats' ? interleaveGuestFacts(liveStats.guestFunFacts) : [];
        const cabinFacts = config.showCabinFacts && display !== 'stats' ? liveStats.cabinFunFacts : [];
        return {
            view: current ? 'occupied' : 'compact',
            display,
            stay: current
                ? { startDate: current.startDate, endDate: current.endDate, remainingNights: current.remainingNights }
                : null,
            guests: current ? current.guests.map((guest) => toGuestView(guest, apiBaseUrl)) : [],
            guestFact: guestFacts[clampIndex(guestFactIndex, guestFacts.length)]?.text ?? null,
            cabinFact: cabinFacts[clampIndex(cabinFactIndex, cabinFacts.length)]?.text ?? null,
            nextVisit: next
                ? {
                    startDate: next.startDate,
                    endDate: next.endDate,
                    daysUntil: next.daysUntil,
                    guests: next.guests.map((guest) => toGuestView(guest, apiBaseUrl)),
                    fact: liveStats.nextVisitFunFacts[0]?.text ?? null,
                }
                : null,
            totals: {
                visits: liveStats.allTimeVisits,
                nights: liveStats.allTimeNights,
                uniqueGuests: liveStats.allTimeUniqueGuests,
            },
            animationSpeed,
        };
    }

    const monthNames = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
    /** Parses `YYYY-MM-DD` without time zone conversion. `undefined` when the text is not such a date. */
    function parseDayAndMonth(date) {
        const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
        if (!match)
            return undefined;
        const month = Number(match[1]);
        const day = Number(match[2]);
        const isValid = month >= 1 && month <= 12 && day >= 1 && day <= 31;
        return isValid ? { day, month } : undefined;
    }
    /** Month abbreviation in Norwegian, e.g. `okt.` for month 10. */
    function monthName(month) {
        return monthNames[month - 1];
    }
    /** One day, e.g. `6. okt.`. */
    function formatSingleDay({ day, month }) {
        return `${day}. ${monthName(month)}`;
    }
    /** Days within one month, e.g. `6.–9. okt.`. Both dates must be in the same month. */
    function formatDaysInSameMonth(start, end) {
        return `${start.day}.–${end.day}. ${monthName(end.month)}`;
    }
    /** Days across two months, e.g. `30. sep.–2. okt.`. */
    function formatDaysAcrossMonths(start, end) {
        return `${formatSingleDay(start)}–${formatSingleDay(end)}`;
    }
    /**
     * Short Norwegian date range from two `YYYY-MM-DD` strings, without the year and without time zone conversion:
     * - same day: `6. okt.`
     * - same month: `6.–9. okt.`
     * - different months: `30. sep.–2. okt.`
     *
     * Falls back to the raw strings (`start–end`) when a date is not valid, so the template never shows nothing.
     */
    function formatDateRange(startDate, endDate) {
        const start = parseDayAndMonth(startDate);
        const end = parseDayAndMonth(endDate);
        if (!start || !end)
            return `${startDate}–${endDate}`;
        const isSameMonth = start.month === end.month;
        const isSameDay = isSameMonth && start.day === end.day;
        if (isSameDay)
            return formatSingleDay(start);
        if (isSameMonth)
            return formatDaysInSameMonth(start, end);
        return formatDaysAcrossMonths(start, end);
    }
    /** Adds the formatted date range to the stay. `null` stays `null`. */
    function withStayDateRange(stay) {
        if (!stay)
            return null;
        return { ...stay, dateRange: formatDateRange(stay.startDate, stay.endDate) };
    }
    /** Adds the formatted date range to the next visit. `null` stays `null`. */
    function withNextVisitDateRange(nextVisit) {
        if (!nextVisit)
            return null;
        return { ...nextVisit, dateRange: formatDateRange(nextVisit.startDate, nextVisit.endDate) };
    }
    /** Adds the formatted date ranges to the view model. Everything else is passed through unchanged. */
    function toTemplateData(viewModel) {
        return {
            ...viewModel,
            stay: withStayDateRange(viewModel.stay),
            nextVisit: withNextVisitDateRange(viewModel.nextVisit),
        };
    }

    const frontendModule = {
        defaults: defaultConfig,
        start() {
            Log__namespace.debug(`${this.name} is starting`);
            this.state = { guestFactIndex: 0, cabinFactIndex: 0 };
            const config = resolveConfig(this.config);
            if (!hasApiBaseUrl(config)) {
                Log__namespace.error(`${this.name} has no valid apiBaseUrl; set it to e.g. http://backend.example:8080`);
            }
            for (const option of Object.keys(config)) {
                if (option !== 'apiBaseUrl' && config[option] !== this.config[option]) {
                    Log__namespace.error(`${this.name} has an invalid ${option}; using ${config[option]}`);
                }
            }
            this.loadData();
            this.startPolling();
            this.startRotation();
            this.updateDom();
        },
        getStyles() {
            return [this.file('css/MMM-CabinStats.css')];
        },
        getTemplate() {
            return 'templates/MMM-CabinStats.njk';
        },
        getTemplateData() {
            return toTemplateData(buildViewModel({
                config: resolveConfig(this.config),
                liveStats: this.state?.liveStats,
                guestFactIndex: this.state?.guestFactIndex ?? 0,
                cabinFactIndex: this.state?.cabinFactIndex ?? 0,
            }));
        },
        getTranslations() {
            // Norwegian only: listing it as the single entry also makes it the fallback for every other language.
            return { nb: 'translations/nb.json' };
        },
        socketNotificationReceived(notificationIdentifier, payload) {
            if (notificationIdentifier === SocketNotification.LIVE_STATS_RESPONSE) {
                if (!isLiveStatsResponse(payload)) {
                    Log__namespace.error(`${this.name} received an invalid live stats response`);
                    return;
                }
                // The helper broadcasts to every instance of this module type.
                if (payload.identifier !== this.identifier) {
                    return;
                }
                Log__namespace.debug(`${this.name} received live stats fetched at ${payload.fetchedAt}`);
                const previous = this.state;
                const guestFacts = interleaveGuestFacts(payload.liveStats.guestFunFacts);
                this.state = {
                    liveStats: payload.liveStats,
                    fetchedAt: payload.fetchedAt,
                    guestFactIndex: clampIndex(previous?.guestFactIndex ?? 0, guestFacts.length),
                    cabinFactIndex: clampIndex(previous?.cabinFactIndex ?? 0, payload.liveStats.cabinFunFacts.length),
                };
                this.startRotation();
                this.updateDom(resolveConfig(this.config).animationSpeed);
            }
            else if (notificationIdentifier === SocketNotification.LIVE_STATS_ERROR) {
                if (!isLiveStatsError(payload)) {
                    Log__namespace.error(`${this.name} received an invalid live stats error`);
                    return;
                }
                if (payload.identifier !== this.identifier) {
                    return;
                }
                // Keep showing the last good data; the helper has already logged the details.
                Log__namespace.error(`${this.name} could not load live stats: ${payload.message}`);
            }
            else {
                Log__namespace.error(`${this.name} received unknown socket notification: '${notificationIdentifier}'`);
            }
        },
        suspend() {
            if (this.config.pauseWhenHidden) {
                this.isPollingSuspended = true;
                this.stopPolling();
                this.stopRotation();
            }
        },
        resume() {
            // Repeated show calls must not create extra timers or requests.
            if (this.config.pauseWhenHidden && this.isPollingSuspended) {
                this.isPollingSuspended = false;
                this.loadData();
                this.startPolling();
                this.startRotation();
            }
        },
        startPolling() {
            this.stopPolling();
            const config = resolveConfig(this.config);
            if (this.isPollingSuspended || !hasApiBaseUrl(config)) {
                return;
            }
            this.pollingTimer = setInterval(() => {
                this.loadData();
            }, config.updateInterval);
        },
        stopPolling() {
            if (this.pollingTimer !== undefined) {
                clearInterval(this.pollingTimer);
                this.pollingTimer = undefined;
            }
        },
        startRotation() {
            this.stopRotation();
            const config = resolveConfig(this.config);
            if (this.isPollingSuspended || !hasApiBaseUrl(config)) {
                return;
            }
            this.guestFactTimer = setInterval(() => {
                this.rotateGuestFact();
            }, config.guestFactInterval);
            this.cabinFactTimer = setInterval(() => {
                this.rotateCabinFact();
            }, config.cabinFactInterval);
        },
        stopRotation() {
            if (this.guestFactTimer !== undefined) {
                clearInterval(this.guestFactTimer);
                this.guestFactTimer = undefined;
            }
            if (this.cabinFactTimer !== undefined) {
                clearInterval(this.cabinFactTimer);
                this.cabinFactTimer = undefined;
            }
        },
        rotateGuestFact() {
            const state = this.state;
            const liveStats = state?.liveStats;
            // Guest facts are only shown for an ongoing reservation, and not at all by a `stats` instance.
            if (resolveConfig(this.config).display === 'stats' ||
                !state ||
                !liveStats?.isOccupied ||
                !liveStats.currentReservation)
                return;
            const length = interleaveGuestFacts(liveStats.guestFunFacts).length;
            if (length <= 1)
                return;
            state.guestFactIndex = nextIndex(state.guestFactIndex, length);
            this.updateDom(resolveConfig(this.config).animationSpeed);
        },
        rotateCabinFact() {
            const state = this.state;
            const config = resolveConfig(this.config);
            if (!state?.liveStats || !config.showCabinFacts || config.display === 'stats')
                return;
            const length = state.liveStats.cabinFunFacts.length;
            if (length <= 1)
                return;
            state.cabinFactIndex = nextIndex(state.cabinFactIndex, length);
            this.updateDom(config.animationSpeed);
        },
        loadData() {
            const config = resolveConfig(this.config);
            if (!hasApiBaseUrl(config)) {
                return;
            }
            Log__namespace.debug(`${this.name} is loading data`);
            const request = { identifier: this.identifier, config: this.config };
            this.sendSocketNotification(SocketNotification.LIVE_STATS_REQUEST, request);
        },
    };
    Module.register('MMM-CabinStats', frontendModule);

}));
//# sourceMappingURL=MMM-CabinStats.js.map
