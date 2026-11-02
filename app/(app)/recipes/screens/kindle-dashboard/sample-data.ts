import type { DashboardData } from "./types";

/**
 * Fixed example data that reproduces the Figma frame 19:1312 ("dashboard v1").
 * Strings keep the Figma characters: the degree-like sign is U+00BA ("º").
 * Used as a visual reference and as a test fixture; the live recipe renders
 * the data from ./getData.ts.
 */
export const SAMPLE_DATA: DashboardData = {
	icon: "sun",
	dial: ["23", "24", "25"],
	min: "22º",
	max: "34º",
	month: "OCT",
	day: "29",
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
		{ label: "LUN", temps: "22º/34º", icon: "sun" },
		{ label: "MAR", temps: "22º/34º", icon: "sun" },
		{ label: "MIE", temps: "22º/34º", icon: "sun" },
		{ label: "JUE", temps: "22º/34º", icon: "sun" },
		{ label: "VIE", temps: "22º/34º", icon: "sun" },
		{ label: "SAB", temps: "22º/34º", icon: "sun" },
		{ label: "DOM", temps: "22º/34º", icon: "sun" },
	],
	rooms: [
		{ name: "Sala", temp: "21º" },
		{ name: "Cocina", temp: "29º" },
		{ name: "Manu", temp: "23º" },
		{ name: "Matías", temp: "24º" },
	],
};
