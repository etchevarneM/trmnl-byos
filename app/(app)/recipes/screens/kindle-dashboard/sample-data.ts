import type { IconName } from "./icons";

export type DashboardData = {
	/** Big icon, top-left. */
	icon: IconName;
	/** Decorative dial: previous, current (outdoor temperature) and next. */
	dial: [number, number, number];
	min: number;
	max: number;
	/** Three-letter month label, e.g. "OCT". */
	month: string;
	day: number;
	/**
	 * 12 bars, one per hour. `hour` is the label; `barPx` is the black bar
	 * height in px (0..81, 81 = full track).
	 */
	rain: { hour: number; barPx: number }[];
	/** 7 rows, in order. */
	days: { label: string; min: number; max: number; icon: IconName }[];
	/** 4 rooms, in order. Values are already formatted ("21º" or "—"). */
	rooms: { name: string; temp: string }[];
};

/**
 * Fixed example data that reproduces the Figma frame 19:1312 ("dashboard v1").
 * Strings keep the Figma characters: the degree-like sign is U+00BA ("º").
 */
export const SAMPLE_DATA: DashboardData = {
	icon: "sun",
	dial: [23, 24, 25],
	min: 22,
	max: 34,
	month: "OCT",
	day: 29,
	rain: [
		{ hour: 7, barPx: 33 },
		{ hour: 8, barPx: 8 },
		{ hour: 9, barPx: 49 },
		{ hour: 10, barPx: 53 },
		{ hour: 11, barPx: 53 },
		{ hour: 12, barPx: 33 },
		{ hour: 13, barPx: 13 },
		{ hour: 14, barPx: 13 },
		{ hour: 15, barPx: 8 },
		{ hour: 16, barPx: 0 },
		{ hour: 17, barPx: 6 },
		{ hour: 18, barPx: 13 },
	],
	days: [
		{ label: "LUN", min: 22, max: 34, icon: "sun" },
		{ label: "MAR", min: 22, max: 34, icon: "sun" },
		{ label: "MIE", min: 22, max: 34, icon: "sun" },
		{ label: "JUE", min: 22, max: 34, icon: "sun" },
		{ label: "VIE", min: 22, max: 34, icon: "sun" },
		{ label: "SAB", min: 22, max: 34, icon: "sun" },
		{ label: "DOM", min: 22, max: 34, icon: "sun" },
	],
	rooms: [
		{ name: "Sala", temp: "21º" },
		{ name: "Cocina", temp: "29º" },
		{ name: "Manu", temp: "23º" },
		{ name: "Matías", temp: "24º" },
	],
};
