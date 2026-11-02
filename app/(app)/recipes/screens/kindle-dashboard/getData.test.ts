import {
	buildDashboardData,
	clockParts,
	fetchHaTemperature,
	fetchWeather,
	formatTemp,
	HA_ROOMS,
	iconForCode,
	parseHaState,
	rainBarPx,
	resetWeatherCache,
	WEATHER_TTL_MS,
	type Weather,
} from "./getData";
import { dataSchema } from "./types";

// 2026-10-29 12:20 in Buenos Aires (UTC-3), a Thursday.
const NOW = new Date("2026-10-29T15:20:00Z");

function makeWeather(): Weather {
	const dates = [
		"2026-10-29",
		"2026-10-30",
		"2026-10-31",
		"2026-11-01",
		"2026-11-02",
		"2026-11-03",
		"2026-11-04",
		"2026-11-05",
	];
	const hourlyTimes: string[] = [];
	for (const date of ["2026-10-29", "2026-10-30"]) {
		for (let h = 0; h < 24; h++) {
			hourlyTimes.push(`${date}T${String(h).padStart(2, "0")}:00`);
		}
	}
	return {
		current: { weather_code: 2, is_day: 1 },
		daily: {
			time: dates,
			weather_code: [0, 3, 61, 71, 95, 45, 2, 0],
			temperature_2m_max: [34.4, 30, 25.5, 2.4, 20, 21, 22, 23],
			temperature_2m_min: [21.6, 20, 18, -0.4, 10, 11, 12, 13],
		},
		hourly: {
			time: hourlyTimes,
			// probability = hour * 4 (so hour 12 -> 48 %, 13 -> 52 %, ...)
			precipitation_probability: hourlyTimes.map((_, i) => (i % 24) * 4),
		},
	};
}

describe("formatting helpers", () => {
	it("formats temperatures with the Figma sign (U+00BA) and rounds", () => {
		expect(formatTemp(21.6)).toBe("22º");
		expect(formatTemp(33.5)).toBe("34º");
		expect(formatTemp(-0.4)).toBe("0º");
		expect(formatTemp(null)).toBe("—");
		expect(formatTemp(undefined)).toBe("—");
		expect(formatTemp(Number.NaN)).toBe("—");
		expect(formatTemp(22).charCodeAt(2)).toBe(0x00ba);
	});

	it("maps WMO codes to icons, with night variants only for 0-2", () => {
		expect(iconForCode(0, true)).toBe("sun");
		expect(iconForCode(1, false)).toBe("moon");
		expect(iconForCode(2, true)).toBe("cloud-sun");
		expect(iconForCode(2, false)).toBe("cloud-moon");
		expect(iconForCode(3, false)).toBe("cloud");
		expect(iconForCode(45, true)).toBe("cloud-fog");
		expect(iconForCode(48, true)).toBe("cloud-fog");
		for (const code of [51, 55, 61, 67, 80, 82]) {
			expect(iconForCode(code, true)).toBe("cloud-rain");
		}
		for (const code of [71, 77, 85, 86]) {
			expect(iconForCode(code, true)).toBe("snowflake");
		}
		for (const code of [95, 96, 99]) {
			expect(iconForCode(code, true)).toBe("cloud-lightning");
		}
		expect(iconForCode(1234, true)).toBe("cloud");
	});

	it("converts precipitation probability to a 0..81 px bar", () => {
		expect(rainBarPx(0)).toBe(0);
		expect(rainBarPx(100)).toBe(81);
		expect(rainBarPx(50)).toBe(41);
		expect(rainBarPx(150)).toBe(81);
		expect(rainBarPx(-5)).toBe(0);
		expect(rainBarPx(null)).toBe(0);
	});

	it("treats unavailable/unknown/garbage Home Assistant states as missing", () => {
		expect(parseHaState("23.4")).toBe(23.4);
		expect(parseHaState(" 21 ")).toBe(21);
		expect(parseHaState("unavailable")).toBeNull();
		expect(parseHaState("unknown")).toBeNull();
		expect(parseHaState("")).toBeNull();
		expect(parseHaState("abc")).toBeNull();
		expect(parseHaState(undefined)).toBeNull();
		expect(parseHaState(23)).toBeNull();
	});

	it("reads the wall clock in Buenos Aires, not UTC", () => {
		expect(clockParts(NOW)).toEqual({
			date: "2026-10-29",
			hour: 12,
			month: 10,
			day: 29,
		});
		// 01:30 UTC is still the previous evening in Buenos Aires.
		expect(clockParts(new Date("2026-11-01T01:30:00Z"))).toEqual({
			date: "2026-10-31",
			hour: 22,
			month: 10,
			day: 31,
		});
		// Local midnight must be hour 0, not 24.
		expect(clockParts(new Date("2026-11-01T03:05:00Z")).hour).toBe(0);
	});
});

describe("buildDashboardData", () => {
	it("assembles the screen from weather and sensors", () => {
		const data = buildDashboardData({
			weather: makeWeather(),
			outdoor: 24.4,
			rooms: [21.2, 29.1, 23, 23.6],
			now: NOW,
		});
		expect(dataSchema.safeParse(data).success).toBe(true);
		expect(data.icon).toBe("cloud-sun");
		expect(data.dial).toEqual(["23", "24", "25"]);
		expect(data.min).toBe("22º");
		expect(data.max).toBe("34º");
		expect(data.month).toBe("OCT");
		expect(data.day).toBe("29");
		expect(data.rooms).toEqual([
			{ name: "Sala", temp: "21º" },
			{ name: "Cocina", temp: "29º" },
			{ name: "Manu", temp: "23º" },
			{ name: "Matías", temp: "24º" },
		]);
		// 7 consecutive days starting tomorrow (Friday), accents-free labels.
		expect(data.days.map((d) => d.label)).toEqual([
			"VIE",
			"SAB",
			"DOM",
			"LUN",
			"MAR",
			"MIE",
			"JUE",
		]);
		expect(data.days[0]).toEqual({
			label: "VIE",
			temps: "20º/30º",
			icon: "cloud",
		});
		expect(data.days[2]).toEqual({
			label: "DOM",
			temps: "0º/2º",
			icon: "snowflake",
		});
		expect(data.days.map((d) => d.icon)).toEqual([
			"cloud",
			"cloud-rain",
			"snowflake",
			"cloud-lightning",
			"cloud-fog",
			"cloud-sun",
			"sun",
		]);
	});

	it("starts the 12 rain bars at the current hour and wraps past midnight", () => {
		const data = buildDashboardData({
			weather: makeWeather(),
			outdoor: null,
			rooms: [null, null, null, null],
			now: NOW,
		});
		expect(data.rain.map((b) => b.hour)).toEqual([
			12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
		]);
		// hour 12 -> 48 % -> 39 px; hour 23 -> 92 % -> 75 px
		expect(data.rain[0]?.barPx).toBe(39);
		expect(data.rain[11]?.barPx).toBe(75);

		const late = buildDashboardData({
			weather: makeWeather(),
			outdoor: null,
			rooms: [null, null, null, null],
			// 21:10 in Buenos Aires
			now: new Date("2026-10-30T00:10:00Z"),
		});
		expect(late.rain.map((b) => b.hour)).toEqual([
			21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8,
		]);
		// The weather fixture only reaches 2026-10-30, so hours that exist are
		// used (21..23 of the 29th have probability, the 0..8 of the 30th too).
		expect(late.rain[0]?.barPx).toBe(rainBarPx(21 * 4));
		expect(late.rain[3]?.barPx).toBe(0);
	});

	it("shows — for everything that failed, and keeps calendar labels", () => {
		const data = buildDashboardData({
			weather: null,
			outdoor: null,
			rooms: [null, null, null, null],
			now: NOW,
		});
		expect(dataSchema.safeParse(data).success).toBe(true);
		expect(data.icon).toBeNull();
		expect(data.dial).toEqual(["", "—", ""]);
		expect(data.min).toBe("—");
		expect(data.max).toBe("—");
		expect(data.month).toBe("OCT");
		expect(data.day).toBe("29");
		expect(data.rain.every((b) => b.barPx === 0)).toBe(true);
		expect(data.rain).toHaveLength(12);
		expect(data.days).toHaveLength(7);
		expect(data.days.map((d) => d.label)).toEqual([
			"VIE",
			"SAB",
			"DOM",
			"LUN",
			"MAR",
			"MIE",
			"JUE",
		]);
		expect(data.days.every((d) => d.temps === "—" && d.icon === null)).toBe(
			true,
		);
		expect(data.rooms.map((r) => r.temp)).toEqual(["—", "—", "—", "—"]);
	});

	it("can lose weather and sensors independently", () => {
		const onlySensors = buildDashboardData({
			weather: null,
			outdoor: 18,
			rooms: [20, null, 22, null],
			now: NOW,
		});
		expect(onlySensors.dial).toEqual(["17", "18", "19"]);
		expect(onlySensors.rooms.map((r) => r.temp)).toEqual([
			"20º",
			"—",
			"22º",
			"—",
		]);

		const onlyWeather = buildDashboardData({
			weather: makeWeather(),
			outdoor: null,
			rooms: [null, null, null, null],
			now: NOW,
		});
		expect(onlyWeather.dial).toEqual(["", "—", ""]);
		expect(onlyWeather.min).toBe("22º");
	});

	it("falls back to schema defaults that are a valid all-missing screen", () => {
		const parsed = dataSchema.parse({});
		expect(parsed.dial).toEqual(["", "—", ""]);
		expect(parsed.rain).toHaveLength(12);
		expect(parsed.days).toHaveLength(7);
		expect(parsed.rooms.map((r) => r.name)).toEqual(
			HA_ROOMS.map((r) => r.name),
		);
	});
});

describe("fetchWeather", () => {
	beforeEach(() => {
		resetWeatherCache();
		jest.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => jest.restoreAllMocks());

	const okResponse = () =>
		({ ok: true, status: 200, json: async () => makeWeather() }) as Response;

	it("caches the forecast for 12 minutes", async () => {
		const fetchFn = jest.fn(async () => okResponse());
		const t0 = 1_000_000;
		expect(await fetchWeather(fetchFn as never, t0)).not.toBeNull();
		expect(
			await fetchWeather(fetchFn as never, t0 + WEATHER_TTL_MS - 1),
		).not.toBeNull();
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(
			await fetchWeather(fetchFn as never, t0 + WEATHER_TTL_MS),
		).not.toBeNull();
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it("asks for the fixed coordinates with a 5 s abort signal", async () => {
		const fetchFn = jest.fn(async () => okResponse());
		await fetchWeather(fetchFn as never, 1);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toContain("latitude=-34.6037");
		expect(url).toContain("longitude=-58.3816");
		expect(url).toContain("timezone=America%2FArgentina%2FBuenos_Aires");
		expect(url).toContain("precipitation_probability");
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("returns null (and does not cache) on HTTP errors, bad JSON and network errors", async () => {
		const failing = [
			jest.fn(async () => ({ ok: false, status: 500 }) as Response),
			jest.fn(
				async () =>
					({ ok: true, status: 200, json: async () => ({}) }) as Response,
			),
			jest.fn(async () => {
				throw new Error("network down");
			}),
		];
		for (const fetchFn of failing) {
			expect(await fetchWeather(fetchFn as never, 5)).toBeNull();
		}
		// A later success is not blocked by the earlier failures.
		const good = jest.fn(async () => okResponse());
		expect(await fetchWeather(good as never, 6)).not.toBeNull();
	});
});

describe("fetchHaTemperature", () => {
	const config = { url: "http://ha.local:8123/", token: "SECRET-TOKEN-123" };

	beforeEach(() => {
		jest.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => jest.restoreAllMocks());

	it("reads the entity state with a bearer token", async () => {
		const fetchFn = jest.fn(
			async () =>
				({
					ok: true,
					status: 200,
					json: async () => ({ state: "23.7" }),
				}) as Response,
		);
		const value = await fetchHaTemperature(
			"sensor.x",
			config,
			fetchFn as never,
		);
		expect(value).toBe(23.7);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe("http://ha.local:8123/api/states/sensor.x");
		expect((init.headers as Record<string, string>).Authorization).toBe(
			"Bearer SECRET-TOKEN-123",
		);
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("does not call out when HA_URL or HA_TOKEN is missing", async () => {
		const fetchFn = jest.fn();
		expect(
			await fetchHaTemperature(
				"sensor.x",
				{ url: undefined, token: "t" },
				fetchFn as never,
			),
		).toBeNull();
		expect(
			await fetchHaTemperature(
				"sensor.x",
				{ url: "http://ha", token: undefined },
				fetchFn as never,
			),
		).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("returns null for unavailable states, HTTP errors and network errors, without leaking the token", async () => {
		const cases = [
			jest.fn(
				async () =>
					({
						ok: true,
						status: 200,
						json: async () => ({ state: "unavailable" }),
					}) as Response,
			),
			jest.fn(async () => ({ ok: false, status: 401 }) as Response),
			jest.fn(async () => {
				throw new Error("connect ECONNREFUSED");
			}),
		];
		for (const fetchFn of cases) {
			expect(
				await fetchHaTemperature("sensor.x", config, fetchFn as never),
			).toBeNull();
		}
		const logged = JSON.stringify((console.warn as jest.Mock).mock.calls);
		expect(logged).not.toContain("SECRET-TOKEN-123");
		expect(logged).toContain("sensor.x");
	});
});
