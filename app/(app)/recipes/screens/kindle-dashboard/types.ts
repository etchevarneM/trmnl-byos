import { z } from "zod";
import { ICON_NAMES } from "./icon-names";

/** Replacement for any value that could not be fetched. */
export const MISSING = "—";

const iconSchema = z.enum(ICON_NAMES).nullable();

/**
 * Display-ready data for the dashboard: every temperature is already a string
 * ("22º" or "—"), so the renderer never decides what to show on failure.
 * The defaults describe an "everything missing" screen, which is what the
 * runtime renders if `getData` ever throws.
 */
export const dataSchema = z.object({
	/** Big icon, top-left. `null` leaves the slot empty. */
	icon: iconSchema.default(null),
	/** Decorative dial: previous, current (outdoor) and next. */
	dial: z
		.tuple([z.string(), z.string(), z.string()])
		.default(["", MISSING, ""]),
	/** Today's minimum and maximum, e.g. "22º". */
	min: z.string().default(MISSING),
	max: z.string().default(MISSING),
	/** Three-letter month label, e.g. "OCT". */
	month: z.string().default(MISSING),
	day: z.string().default(MISSING),
	/**
	 * 12 bars, one per hour. `hour` is the label; `barPx` is the black bar
	 * height in px (0..81, 81 = full track).
	 */
	rain: z
		.array(z.object({ hour: z.number(), barPx: z.number() }))
		.length(12)
		.default(() =>
			Array.from({ length: 12 }, (_, i) => ({ hour: i, barPx: 0 })),
		),
	/** 7 rows, in order. `temps` is "22º/34º" or "—". */
	days: z
		.array(z.object({ label: z.string(), temps: z.string(), icon: iconSchema }))
		.length(7)
		.default(() =>
			Array.from({ length: 7 }, () => ({
				label: MISSING,
				temps: MISSING,
				icon: null,
			})),
		),
	/** 4 rooms, in order. Values are "21º" or "—". */
	rooms: z
		.array(z.object({ name: z.string(), temp: z.string() }))
		.length(4)
		.default(() =>
			["Sala", "Cocina", "Manu", "Matías"].map((name) => ({
				name,
				temp: MISSING,
			})),
		),
});

export type DashboardData = z.infer<typeof dataSchema>;
