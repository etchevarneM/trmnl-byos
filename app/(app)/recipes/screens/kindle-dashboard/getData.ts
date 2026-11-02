import { z } from "zod";
import type { IconName } from "./icon-names";
import { SAMPLE_DATA } from "./sample-data";
import { type DashboardData, MISSING } from "./types";

/**
 * Live data for the Kindle dashboard.
 *
 *  - Weather: Open-Meteo (no key), fixed coordinates, cached in memory for
 *    12 minutes.
 *  - Temperatures: Home Assistant (`HA_URL` + `HA_TOKEN`, set in the server
 *    environment; the token is never logged).
 *
 * Every call has a 5 s timeout and every failure becomes "—" on screen:
 * `getData` never throws.
 */

export const TIMEZONE = "America/Argentina/Buenos_Aires";
const LATITUDE = -34.6037;
const LONGITUDE = -58.3816;

export const FETCH_TIMEOUT_MS = 5_000;
export const WEATHER_TTL_MS = 12 * 60 * 1000;
/** If Open-Meteo fails, the last good forecast is reused for up to this long. */
export const WEATHER_STALE_MAX_MS = 6 * 60 * 60 * 1000;
export const RAIN_TRACK_PX = 81;

const MONTHS = [
	"ENE",
	"FEB",
	"MAR",
	"ABR",
	"MAY",
	"JUN",
	"JUL",
	"AGO",
	"SEP",
	"OCT",
	"NOV",
	"DIC",
];
// Index = Date#getUTCDay (0 = Sunday). No accents, as in the Figma.
const WEEKDAYS = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

export const HA_OUTDOOR_ENTITY = "sensor.sensor_afuera_temperature";
export const HA_ROOMS = [
	{ name: "Sala", entity: "sensor.sensor_temp_sala_temperature" },
	{ name: "Cocina", entity: "sensor.sensor_cocina_temperature" },
	{ name: "Manu", entity: "sensor.sensor_temp_manu_temperature" },
	{ name: "Matías", entity: "sensor.sensor_temp_matias_temperature" },
] as const;

type FetchFn = typeof fetch;

// ---------------------------------------------------------------- formatting

/** "22º" (U+00BA, as in the Figma) or "—". */
export function formatTemp(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return MISSING;
	return `${Math.round(value)}º`;
}

/** Open-Meteo WMO weather code to icon. Unknown codes fall back to "cloud". */
export function iconForCode(code: number, isDay: boolean): IconName {
	if (code === 0 || code === 1) return isDay ? "sun" : "moon";
	if (code === 2) return isDay ? "cloud-sun" : "cloud-moon";
	if (code === 3) return "cloud";
	if (code === 45 || code === 48) return "cloud-fog";
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
		return "cloud-rain";
	if ((code >= 71 && code <= 77) || code === 85 || code === 86)
		return "snowflake";
	if (code >= 95 && code <= 99) return "cloud-lightning";
	return "cloud";
}

/** Precipitation probability (0..100) to black bar height in px (0..81). */
export function rainBarPx(probability: number | null | undefined): number {
	if (probability == null || !Number.isFinite(probability)) return 0;
	const clamped = Math.min(100, Math.max(0, probability));
	return Math.round((clamped / 100) * RAIN_TRACK_PX);
}

/** Home Assistant state string to a number, or null for unavailable/unknown. */
export function parseHaState(state: unknown): number | null {
	if (typeof state !== "string") return null;
	const trimmed = state.trim();
	if (trimmed === "" || trimmed === "unavailable" || trimmed === "unknown")
		return null;
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
}

// --------------------------------------------------------------------- clock

type ClockParts = { date: string; hour: number; month: number; day: number };

/** Wall-clock date and hour in the dashboard's time zone. */
export function clockParts(now: Date): ClockParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const year = get("year");
	const month = get("month");
	const day = get("day");
	const pad = (n: number) => String(n).padStart(2, "0");
	return {
		date: `${year}-${pad(month)}-${pad(day)}`,
		hour: get("hour") % 24,
		month,
		day,
	};
}

function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayLabel(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? MISSING;
}

// ------------------------------------------------------------------- weather

const weatherSchema = z.object({
	current: z.object({
		weather_code: z.number(),
		is_day: z.number(),
	}),
	daily: z.object({
		time: z.array(z.string()),
		weather_code: z.array(z.number().nullable()),
		temperature_2m_max: z.array(z.number().nullable()),
		temperature_2m_min: z.array(z.number().nullable()),
	}),
	hourly: z.object({
		time: z.array(z.string()),
		precipitation_probability: z.array(z.number().nullable()),
	}),
});

export type Weather = z.infer<typeof weatherSchema>;

let weatherCache: { fetchedAt: number; data: Weather } | null = null;

export function resetWeatherCache(): void {
	weatherCache = null;
}

export function weatherUrl(): string {
	const query = new URLSearchParams({
		latitude: String(LATITUDE),
		longitude: String(LONGITUDE),
		timezone: TIMEZONE,
		current: "weather_code,is_day",
		daily: "weather_code,temperature_2m_max,temperature_2m_min",
		hourly: "precipitation_probability",
		forecast_days: "8",
	});
	return `https://api.open-meteo.com/v1/forecast?${query.toString()}`;
}

/**
 * Open-Meteo forecast, cached for 12 minutes. On a failure it falls back to
 * the last good forecast (up to 6 h old, a forecast moves slowly) so one slow
 * request does not blank the whole column; with nothing to fall back on it
 * returns null.
 */
export async function fetchWeather(
	fetchFn: FetchFn = fetch,
	nowMs: number = Date.now(),
): Promise<Weather | null> {
	if (weatherCache && nowMs - weatherCache.fetchedAt < WEATHER_TTL_MS) {
		return weatherCache.data;
	}
	try {
		const res = await fetchFn(weatherUrl(), {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			cache: "no-store",
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = weatherSchema.parse(await res.json());
		weatherCache = { fetchedAt: nowMs, data };
		return data;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		if (weatherCache && nowMs - weatherCache.fetchedAt < WEATHER_STALE_MAX_MS) {
			console.warn(
				`[kindle-dashboard] Open-Meteo failed (${reason}); using the forecast from ${Math.round((nowMs - weatherCache.fetchedAt) / 60000)} min ago`,
			);
			return weatherCache.data;
		}
		console.warn("[kindle-dashboard] Open-Meteo failed:", reason);
		return null;
	}
}

// ------------------------------------------------------------ home assistant

export type HaConfig = { url: string | undefined; token: string | undefined };

export function haConfigFromEnv(
	env: NodeJS.ProcessEnv = process.env,
): HaConfig {
	return { url: env.HA_URL, token: env.HA_TOKEN };
}

/** One Home Assistant sensor as a number, or null (not configured, down, unavailable). */
export async function fetchHaTemperature(
	entity: string,
	config: HaConfig,
	fetchFn: FetchFn = fetch,
): Promise<number | null> {
	if (!config.url || !config.token) return null;
	try {
		const res = await fetchFn(
			`${config.url.replace(/\/+$/, "")}/api/states/${entity}`,
			{
				headers: { Authorization: `Bearer ${config.token}` },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				cache: "no-store",
			},
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as { state?: unknown };
		return parseHaState(body.state);
	} catch (error) {
		// Never log headers or the token; the entity id is enough to debug.
		console.warn(
			`[kindle-dashboard] Home Assistant ${entity} failed:`,
			error instanceof Error ? error.message : String(error),
		);
		return null;
	}
}

// ---------------------------------------------------------------- assembling

export type DashboardInputs = {
	weather: Weather | null;
	/** Outdoor temperature (the dial's centre value). */
	outdoor: number | null;
	/** Room temperatures, in the order of `HA_ROOMS`. */
	rooms: (number | null)[];
	now: Date;
};

export function buildDashboardData({
	weather,
	outdoor,
	rooms,
	now,
}: DashboardInputs): DashboardData {
	const clock = clockParts(now);

	// Dial: decorative; centre is the outdoor temperature, neighbours are ±1.
	const centre = outdoor == null ? null : Math.round(outdoor);
	const dial: DashboardData["dial"] =
		centre == null
			? ["", MISSING, ""]
			: [String(centre - 1), String(centre), String(centre + 1)];

	// Daily rows: 7 consecutive days starting tomorrow (today is already shown
	// in the min/max block). The labels come from the calendar, so they are
	// right even if the forecast failed. `forecast_days=8` covers today + 7.
	const dailyStart = weather
		? Math.max(0, weather.daily.time.indexOf(clock.date))
		: 0;
	const days = Array.from({ length: 7 }, (_, i) => {
		const date = addDays(clock.date, i + 1);
		const idx = dailyStart + i + 1;
		const min = weather?.daily.temperature_2m_min[idx];
		const max = weather?.daily.temperature_2m_max[idx];
		const code = weather?.daily.weather_code[idx];
		const hasTemps = min != null && max != null;
		return {
			label: weekdayLabel(date),
			temps: hasTemps ? `${formatTemp(min)}/${formatTemp(max)}` : MISSING,
			// The list always uses the day variant of the icon.
			icon: code == null ? null : iconForCode(code, true),
		};
	});

	// Rain: next 12 hours starting at the current hour; probability -> bar px.
	const currentHourKey = `${clock.date}T${String(clock.hour).padStart(2, "0")}:00`;
	const hourlyStart = weather
		? weather.hourly.time.indexOf(currentHourKey)
		: -1;
	const rain = Array.from({ length: 12 }, (_, i) => ({
		hour: (clock.hour + i) % 24,
		barPx:
			weather && hourlyStart >= 0
				? rainBarPx(weather.hourly.precipitation_probability[hourlyStart + i])
				: 0,
	}));

	return {
		icon: weather
			? iconForCode(weather.current.weather_code, weather.current.is_day === 1)
			: null,
		dial,
		min: formatTemp(weather?.daily.temperature_2m_min[dailyStart]),
		max: formatTemp(weather?.daily.temperature_2m_max[dailyStart]),
		month: MONTHS[clock.month - 1] ?? MISSING,
		day: String(clock.day),
		rain,
		days,
		rooms: HA_ROOMS.map((room, i) => ({
			name: room.name,
			temp: formatTemp(rooms[i]),
		})),
	};
}

/** Fetches everything in parallel (each call capped at 5 s) and assembles it. */
export async function getData(): Promise<DashboardData> {
	// Dev/visual-regression switch: render the fixed Figma mockup values.
	if (process.env.KINDLE_DASHBOARD_SAMPLE === "1") return SAMPLE_DATA;
	const ha = haConfigFromEnv();
	const [weather, outdoor, ...rooms] = await Promise.all([
		fetchWeather(),
		fetchHaTemperature(HA_OUTDOOR_ENTITY, ha),
		...HA_ROOMS.map((room) => fetchHaTemperature(room.entity, ha)),
	]);
	return buildDashboardData({ weather, outdoor, rooms, now: new Date() });
}
