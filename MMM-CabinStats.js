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
    /** Defaults of every option except `apiBaseUrl`, which is required and has no default. `apiToken` is optional. */
    const defaultConfig = {
        apiBaseUrl: undefined,
        apiToken: undefined,
        updateInterval: 600_000,
        requestTimeout: 10_000,
        guestFactInterval: 18_000,
        cabinFactInterval: 45_000,
        display: 'full',
        guestView: true,
        guestViewTimeout: 60_000,
        guestViewFactInterval: 7_000,
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
    function nonEmptyString(value) {
        if (typeof value !== 'string')
            return undefined;
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
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
            apiToken: nonEmptyString(config.apiToken),
            updateInterval: positiveTimerDelay(config.updateInterval, defaultConfig.updateInterval),
            requestTimeout: positiveTimerDelay(config.requestTimeout, defaultConfig.requestTimeout),
            guestFactInterval: positiveTimerDelay(config.guestFactInterval, defaultConfig.guestFactInterval),
            cabinFactInterval: positiveTimerDelay(config.cabinFactInterval, defaultConfig.cabinFactInterval),
            display: oneOf(config.display, displays, defaultConfig.display),
            guestView: boolean(config.guestView, defaultConfig.guestView),
            guestViewTimeout: positiveTimerDelay(config.guestViewTimeout, defaultConfig.guestViewTimeout),
            guestViewFactInterval: positiveTimerDelay(config.guestViewFactInterval, defaultConfig.guestViewFactInterval),
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
        SocketNotification["GUEST_PROFILE_REQUEST"] = "GUEST_PROFILE_REQUEST";
        SocketNotification["GUEST_PROFILE_RESPONSE"] = "GUEST_PROFILE_RESPONSE";
        SocketNotification["GUEST_PROFILE_ERROR"] = "GUEST_PROFILE_ERROR";
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
            isNumber(value.totalNights) &&
            isOptional(value.visitsRank, isNumber) &&
            isOptional(value.daysRank, isNumber) &&
            isOptional(value.visitsRankAmongGuests, isNumber) &&
            isOptional(value.daysRankAmongGuests, isNumber));
    }
    /** Type guard for {@link GuestStats}. */
    function isGuestStats(value) {
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
            isArrayOf(value.guests, isGuestStats) &&
            isNumber(value.remainingNights));
    }
    function isNextReservation(value) {
        return (isRecord$1(value) &&
            isIsoDate(value.startDate) &&
            isIsoDate(value.endDate) &&
            isArrayOf(value.guests, isGuestStats) &&
            isNumber(value.daysUntil));
    }
    /** Type guard for {@link FactSegment}. Any string is accepted as `kind`: the backend may add kinds later. */
    function isFactSegment(value) {
        return isRecord$1(value) && isString(value.text) && isOptional(value.kind, isString);
    }
    /** Type guard for {@link FunFact}. */
    function isFunFact(value) {
        return (isRecord$1(value) &&
            isOptional(value.guestId, isString) &&
            isString(value.text) &&
            isNumber(value.priority) &&
            isOptional(value.segments, (segments) => isArrayOf(segments, isFactSegment)));
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

    const visitStatuses = ['COMPLETED', 'ONGOING', 'UPCOMING'];
    function isGuestVisit(value) {
        return (isRecord$1(value) &&
            isIsoDate(value.startDate) &&
            isIsoDate(value.endDate) &&
            isNumber(value.days) &&
            isNumber(value.nights) &&
            isString(value.status) &&
            visitStatuses.some((status) => status === value.status));
    }
    /**
     * Type guard for {@link GuestProfileStats}. The payload crosses a runtime boundary (backend response), so every
     * field the module reads is checked.
     */
    function isGuestProfileStats(value) {
        return (isRecord$1(value) &&
            isGuestStats(value.guest) &&
            isArrayOf(value.visits, isGuestVisit) &&
            isArrayOf(value.funFacts, isFunFact));
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
    /** Type guard for {@link GuestProfileResponse}. */
    function isGuestProfileResponse(payload) {
        return (isRecord(payload) &&
            typeof payload.identifier === 'string' &&
            typeof payload.guestId === 'string' &&
            isGuestProfileStats(payload.profile));
    }
    /** Type guard for {@link GuestProfileError}. */
    function isGuestProfileError(payload) {
        return (isRecord(payload) &&
            typeof payload.identifier === 'string' &&
            typeof payload.guestId === 'string' &&
            typeof payload.message === 'string');
    }

    function kindOf(kind) {
        return kind === 'stat' || kind === 'guest' ? kind : 'text';
    }
    /**
     * The parts to highlight in a fact. The backend sends `segments` that joined together equal `text`. An older backend,
     * or a hand-built fact, has none: the whole text is then one plain part. A kind other than `stat` or `guest` is shown
     * as plain text, because the backend may add kinds later.
     */
    function toFactView(fact) {
        const segments = fact.segments?.length
            ? fact.segments.map(({ text, kind }) => ({ text, kind: kindOf(kind) }))
            : [{ text: fact.text, kind: 'text' }];
        return { text: fact.text, segments };
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
    /**
     * The guest facts that rotate right now: about the current guests while the cabin is occupied, otherwise about the next
     * visit (only when it is shown). Same order rules in both cases, see `interleaveGuestFacts`.
     */
    function rotatingGuestFacts(liveStats, showNextVisit) {
        if (liveStats.isOccupied && liveStats.currentReservation)
            return interleaveGuestFacts(liveStats.guestFunFacts);
        if (showNextVisit && liveStats.nextReservation)
            return interleaveGuestFacts(liveStats.nextVisitFunFacts);
        return [];
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
        guestView: false,
        stay: null,
        guests: [],
        guestFact: null,
        cabinFact: null,
        nextVisit: null,
        totals: null,
        animationSpeed,
    });
    /**
     * Joins the base url with the relative avatar url from the backend. `null` when either is missing. A `data:` url,
     * which the node helper makes of an avatar it fetched with the API key, is used as is.
     */
    function avatarUrlFor(apiBaseUrl, avatarUrl) {
        if (avatarUrl?.startsWith('data:'))
            return avatarUrl;
        if (!apiBaseUrl || !avatarUrl)
            return null;
        return `${apiBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
    }
    /** The fact at the index, which is clamped into the list. `null` when the list is empty. */
    function factAt(facts, index) {
        const fact = facts[clampIndex(index, facts.length)];
        return fact ? toFactView(fact) : null;
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
        const guestFacts = display !== 'stats' ? rotatingGuestFacts(liveStats, config.showNextVisit) : [];
        const cabinFacts = config.showCabinFacts && display !== 'stats' ? liveStats.cabinFunFacts : [];
        return {
            view: current ? 'occupied' : 'compact',
            display,
            guestView: config.guestView,
            stay: current
                ? { startDate: current.startDate, endDate: current.endDate, remainingNights: current.remainingNights }
                : null,
            guests: current ? current.guests.map((guest) => toGuestView(guest, apiBaseUrl)) : [],
            guestFact: factAt(guestFacts, guestFactIndex),
            cabinFact: factAt(cabinFacts, cabinFactIndex),
            nextVisit: next
                ? {
                    startDate: next.startDate,
                    endDate: next.endDate,
                    daysUntil: next.daysUntil,
                    guests: next.guests.map((guest) => toGuestView(guest, apiBaseUrl)),
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

    const monthNames = [
        'jan.',
        'feb.',
        'mars',
        'apr.',
        'mai',
        'juni',
        'juli',
        'aug.',
        'sep.',
        'okt.',
        'nov.',
        'des.',
    ];
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

    /** First year of the heatmap. The backend data starts in September 2020, so every guest gets the same grid. */
    const heatmapStartYear = 2020;
    /** First month with data in {@link heatmapStartYear}. Earlier months are shown as "no data". */
    const dataStartMonth = 9;
    /** The year and month (1 to 12) of a date, in the local time zone of the mirror. */
    function yearMonthOf(date) {
        return { year: date.getFullYear(), month: date.getMonth() + 1 };
    }
    function levelOf(count) {
        return Math.min(count, 4);
    }
    function monthKey(date) {
        return date.slice(0, 7);
    }
    function stateOf(year, month, today) {
        if (year === heatmapStartYear && month < dataStartMonth)
            return 'nodata';
        if (year > today.year || (year === today.year && month > today.month))
            return 'future';
        return 'past';
    }
    /**
     * One row per year from 2020 to the current year, one cell per month. A visit counts in the month it started, like
     * the backend counts visits. Completed and ongoing visits colour the cell, upcoming visits only mark it.
     */
    function buildHeatmap(visits, today) {
        const started = new Map();
        const upcoming = new Set();
        for (const visit of visits) {
            const key = monthKey(visit.startDate);
            if (visit.status === 'UPCOMING')
                upcoming.add(key);
            else
                started.set(key, (started.get(key) ?? 0) + 1);
        }
        const lastYear = Math.max(today.year, heatmapStartYear);
        return Array.from({ length: lastYear - heatmapStartYear + 1 }, (_, index) => {
            const year = heatmapStartYear + index;
            const cells = Array.from({ length: 12 }, (_, monthIndex) => {
                const month = monthIndex + 1;
                const key = `${year}-${String(month).padStart(2, '0')}`;
                const state = stateOf(year, month, today);
                const count = state === 'past' ? (started.get(key) ?? 0) : 0;
                return { month, count, level: levelOf(count), state, hasUpcoming: upcoming.has(key) };
            });
            return { year, cells };
        });
    }
    /** One decimal with a Norwegian comma, e.g. `18,6`. */
    function formatDecimal(value) {
        return value.toFixed(1).replace('.', ',');
    }
    /** `2020-10-29` as `okt. 2020`. `null` when the text is not a date. */
    function formatMonthYear(date) {
        const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
        const month = match ? monthNames[Number(match[2]) - 1] : undefined;
        return match && month ? `${month} ${match[1]}` : null;
    }
    /** `2025-10-05` as `5. okt. 2025`. `null` when the text is not a date. */
    function formatFullDate(date) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
        const month = match ? monthNames[Number(match[2]) - 1] : undefined;
        return match && month ? `${Number(match[3])}. ${month} ${match[1]}` : null;
    }
    function primaryTiles(profile, heatmap, yearsInGrid) {
        const { totalVisits } = profile.guest.allTime;
        if (totalVisits === 0)
            return [];
        const maxPerMonth = Math.max(...heatmap.flatMap((row) => row.cells.map((cell) => cell.count)));
        const yearsWithVisits = profile.guest.yearsVisited.filter((year) => year >= heatmapStartYear).length;
        return [
            { id: 'visitsPerYear', value: formatDecimal(totalVisits / yearsInGrid) },
            { id: 'maxPerMonth', value: String(maxPerMonth) },
            { id: 'yearsWithVisits', value: String(yearsWithVisits), of: yearsInGrid },
        ];
    }
    function secondaryTiles(profile) {
        const { guest, visits } = profile;
        const tiles = [];
        if (guest.allTime.totalDays > 0)
            tiles.push({ id: 'days', value: String(guest.allTime.totalDays) });
        if (guest.allTime.totalNights > 0)
            tiles.push({ id: 'nights', value: String(guest.allTime.totalNights) });
        const longestStay = Math.max(0, ...visits.filter((visit) => visit.status !== 'UPCOMING').map((visit) => visit.nights));
        if (longestStay > 0)
            tiles.push({ id: 'longestStay', value: String(longestStay) });
        if (guest.currentYear.totalVisits > 0) {
            tiles.push({ id: 'visitsThisYear', value: String(guest.currentYear.totalVisits) });
        }
        return tiles;
    }
    function rankOf(profile) {
        const { guest } = profile;
        const rank = guest.isFamily ? guest.allTime.visitsRank : guest.allTime.visitsRankAmongGuests;
        return rank === null || rank === undefined ? null : { value: `#${rank}`, accent: rank === 1 };
    }
    /** Builds what the profile part of the guest view renders from the backend profile and the current month. */
    function buildProfileModel(profile, today) {
        const heatmap = buildHeatmap(profile.visits, today);
        const yearsInGrid = heatmap.length;
        const { firstVisitDate, lastVisitDate } = profile.guest;
        return {
            firstYear: heatmapStartYear,
            lastYear: heatmapStartYear + yearsInGrid - 1,
            rank: rankOf(profile),
            totalVisits: profile.guest.allTime.totalVisits,
            yearsInGrid,
            heatmap,
            primaryTiles: primaryTiles(profile, heatmap, yearsInGrid),
            secondaryTiles: secondaryTiles(profile),
            firstVisit: firstVisitDate ? formatMonthYear(firstVisitDate) : null,
            lastVisit: lastVisitDate ? formatFullDate(lastVisitDate) : null,
            facts: profile.funFacts.map(toFactView),
        };
    }

    /** Finds a guest of the ongoing or the next reservation. `undefined` when the guest is not in the live stats. */
    function findGuest(liveStats, guestId) {
        const guests = [...(liveStats?.currentReservation?.guests ?? []), ...(liveStats?.nextReservation?.guests ?? [])];
        return guests.find((guest) => guest.guestId === guestId);
    }
    /** Builds what the overlay renders from the state of the view and the current month. */
    function buildGuestOverlayModel({ guest, status, profile, factIndex }, apiBaseUrl, today) {
        return {
            guestId: guest.guestId,
            fullName: `${guest.firstName} ${guest.lastName}`.trim(),
            firstName: guest.firstName,
            initials: initials(guest.firstName, guest.lastName),
            avatarUrl: avatarUrlFor(apiBaseUrl, guest.avatarUrl),
            status,
            profile: status === 'loaded' && profile ? buildProfileModel(profile, today) : undefined,
            factIndex,
        };
    }

    /**
     * Turns the rendered `templates/guest-view.njk` into the full-screen guest view and connects the buttons. It is meant
     * to be appended to `document.body`, outside the module's own DOM, so that a re-render of the module (live stats
     * polling) never touches it.
     *
     * @throws Error when the html has no root element.
     */
    function createGuestOverlay(html, handlers) {
        const host = document.createElement('div');
        host.innerHTML = html;
        const overlay = host.firstElementChild;
        if (!(overlay instanceof HTMLElement))
            throw new Error('The guest view template rendered no element');
        overlay.addEventListener('pointerdown', handlers.onActivity);
        overlay.addEventListener('click', (event) => {
            const action = event.target instanceof Element ? event.target.closest('[data-cabin-action]') : null;
            if (action?.getAttribute('data-cabin-action') === 'close')
                handlers.onClose();
            if (action?.getAttribute('data-cabin-action') === 'retry')
                handlers.onRetry();
        });
        return overlay;
    }
    /** Shows another fun fact in an open guest view with a fade, without rebuilding anything else. */
    function updateGuestOverlayFact(overlay, fact) {
        const element = overlay.querySelector('.cabin-profile-fact');
        if (!element)
            return;
        element.classList.remove('cabin-fade-in');
        // Reading a layout property restarts the CSS animation.
        void element.offsetWidth;
        // Text nodes and `textContent` only: the texts come from the backend and must not be parsed as html.
        element.replaceChildren(...fact.segments.map(({ text, kind }) => {
            if (kind === 'text')
                return document.createTextNode(text);
            const span = document.createElement('span');
            span.className = `cabin-highlight cabin-highlight-${kind}`;
            span.textContent = text;
            return span;
        }));
        element.classList.add('cabin-fade-in');
    }

    const frontendModule = {
        defaults: defaultConfig,
        guestViewRenderCount: 0,
        start() {
            Log__namespace.debug(`${this.name} is starting`);
            this.state = { guestFactIndex: 0, cabinFactIndex: 0 };
            const config = resolveConfig(this.config);
            if (!hasApiBaseUrl(config)) {
                Log__namespace.error(`${this.name} has no valid apiBaseUrl; set it to e.g. http://backend.example:8080`);
            }
            for (const option of Object.keys(config)) {
                if (option !== 'apiBaseUrl' && option !== 'apiToken' && config[option] !== this.config[option]) {
                    Log__namespace.error(`${this.name} has an invalid ${option}; using ${config[option]}`);
                }
            }
            this.loadData();
            this.startPolling();
            this.startRotation();
            this.updateDom();
        },
        notificationReceived(notification) {
            // The avatars are re-created on every render, so one delegated listener on the document serves them all.
            if (notification === 'DOM_OBJECTS_CREATED' && !this.documentClickHandler) {
                this.documentClickHandler = (event) => {
                    const avatar = event.target instanceof Element ? event.target.closest('[data-cabin-guest-id]') : null;
                    // Several instances share the page: only react to the avatars of this one.
                    if (avatar?.closest('.module')?.id !== this.identifier)
                        return;
                    const guestId = avatar.dataset.cabinGuestId;
                    if (guestId)
                        this.openGuestView(guestId);
                };
                document.addEventListener('click', this.documentClickHandler);
            }
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
                const guestFacts = rotatingGuestFacts(payload.liveStats, resolveConfig(this.config).showNextVisit);
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
            else if (notificationIdentifier === SocketNotification.GUEST_PROFILE_RESPONSE) {
                if (!isGuestProfileResponse(payload)) {
                    Log__namespace.error(`${this.name} received an invalid guest profile response`);
                    return;
                }
                this.finishGuestProfile(payload.identifier, payload.guestId, 'loaded', payload.profile);
            }
            else if (notificationIdentifier === SocketNotification.GUEST_PROFILE_ERROR) {
                if (!isGuestProfileError(payload)) {
                    Log__namespace.error(`${this.name} received an invalid guest profile error`);
                    return;
                }
                if (payload.identifier === this.identifier) {
                    Log__namespace.error(`${this.name} could not load guest profile: ${payload.message}`);
                }
                this.finishGuestProfile(payload.identifier, payload.guestId, 'error');
            }
            else {
                Log__namespace.error(`${this.name} received unknown socket notification: '${notificationIdentifier}'`);
            }
        },
        suspend() {
            this.closeGuestView();
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
            const config = resolveConfig(this.config);
            // A `stats` instance shows no facts.
            if (!state?.liveStats || config.display === 'stats')
                return;
            const length = rotatingGuestFacts(state.liveStats, config.showNextVisit).length;
            if (length <= 1)
                return;
            state.guestFactIndex = nextIndex(state.guestFactIndex, length);
            this.updateDom(config.animationSpeed);
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
        openGuestView(guestId) {
            const config = resolveConfig(this.config);
            const guest = findGuest(this.state?.liveStats, guestId);
            if (!this.state || !config.guestView || !hasApiBaseUrl(config) || !guest)
                return;
            this.state.guestView = { guest, status: 'loading', factIndex: 0 };
            this.documentKeyHandler ??= (event) => {
                if (event.key === 'Escape')
                    this.closeGuestView();
            };
            document.addEventListener('keydown', this.documentKeyHandler);
            this.renderGuestView();
            this.startGuestViewTimeout();
            this.requestGuestProfile(guestId);
        },
        closeGuestView() {
            clearTimeout(this.guestViewTimer);
            this.guestViewTimer = undefined;
            this.stopGuestViewFactRotation();
            if (this.documentKeyHandler) {
                document.removeEventListener('keydown', this.documentKeyHandler);
                this.documentKeyHandler = undefined;
            }
            this.guestViewRenderCount++;
            this.guestOverlay?.remove();
            this.guestOverlay = undefined;
            if (this.state)
                this.state.guestView = undefined;
        },
        renderGuestView() {
            const guestView = this.state?.guestView;
            if (!guestView)
                return;
            const renderId = ++this.guestViewRenderCount;
            const model = buildGuestOverlayModel(guestView, resolveConfig(this.config).apiBaseUrl, yearMonthOf(new Date()));
            this.nunjucksEnvironment().render('templates/guest-view.njk', model, (error, html) => {
                // The view may have been closed, or rendered again, while the template was loading.
                if (renderId !== this.guestViewRenderCount || this.state?.guestView !== guestView)
                    return;
                if (error || html === null) {
                    Log__namespace.error(`${this.name} could not render the guest view: ${error?.message ?? 'no output'}`);
                    return;
                }
                const overlay = createGuestOverlay(html, {
                    onClose: () => this.closeGuestView(),
                    onRetry: () => {
                        this.stopGuestViewFactRotation();
                        guestView.status = 'loading';
                        guestView.profile = undefined;
                        guestView.factIndex = 0;
                        this.renderGuestView();
                        this.requestGuestProfile(guestView.guest.guestId);
                    },
                    onActivity: () => this.startGuestViewTimeout(),
                });
                if (this.guestOverlay) {
                    this.guestOverlay.replaceWith(overlay);
                }
                else {
                    document.body.append(overlay);
                }
                this.guestOverlay = overlay;
                overlay.querySelector('.cabin-overlay-close')?.focus();
            });
        },
        startGuestViewTimeout() {
            clearTimeout(this.guestViewTimer);
            this.guestViewTimer = setTimeout(() => {
                this.closeGuestView();
            }, resolveConfig(this.config).guestViewTimeout);
        },
        requestGuestProfile(guestId) {
            const request = { identifier: this.identifier, guestId, config: this.config };
            this.sendSocketNotification(SocketNotification.GUEST_PROFILE_REQUEST, request);
        },
        finishGuestProfile(identifier, guestId, status, profile) {
            // The helper broadcasts to every instance of this module type. A reply for a view that was closed or switched
            // to another guest in the meantime is stale.
            const guestView = this.state?.guestView;
            if (identifier !== this.identifier || guestView?.guest.guestId !== guestId || guestView.status !== 'loading')
                return;
            guestView.status = status;
            guestView.profile = profile;
            guestView.factIndex = 0;
            this.renderGuestView();
            if (status === 'loaded')
                this.startGuestViewFactRotation();
        },
        startGuestViewFactRotation() {
            this.stopGuestViewFactRotation();
            if ((this.state?.guestView?.profile?.funFacts.length ?? 0) <= 1)
                return;
            this.guestViewFactTimer = setInterval(() => {
                this.rotateGuestViewFact();
            }, resolveConfig(this.config).guestViewFactInterval);
        },
        stopGuestViewFactRotation() {
            clearInterval(this.guestViewFactTimer);
            this.guestViewFactTimer = undefined;
        },
        rotateGuestViewFact() {
            const guestView = this.state?.guestView;
            const facts = guestView?.profile?.funFacts;
            if (!guestView || !facts || facts.length <= 1 || !this.guestOverlay)
                return;
            guestView.factIndex = nextIndex(guestView.factIndex, facts.length);
            updateGuestOverlayFact(this.guestOverlay, toFactView(facts[guestView.factIndex]));
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
