import type { CSSProperties, ReactNode } from "react";
import { z } from "zod";
import type { RecipeDefinition } from "@/lib/recipes/types";
import type { ScreenProfile } from "@/lib/trmnl/screen-profile";
import { getData } from "./getData";
import { BigIcon, SmallIcon } from "./icons";
import { type DashboardData, dataSchema } from "./types";

/**
 * "dashboard v1" for the Kindle Voyage, 1:1 with Figma frame 19:1312
 * (file p79jARoiQsLSkMyR499fKV). The Figma frame is the full landscape page of
 * 1448x1072 physical pixels, so every number below is a physical pixel.
 *
 * Data comes from ./getData.ts (Open-Meteo + Home Assistant). ./sample-data.ts
 * holds the fixed values that reproduce the Figma mockup.
 */

const DESIGN_WIDTH = 1448;
const DESIGN_HEIGHT = 1072;
const FONT = "Reddit Mono";

export const paramsSchema = z.object({});
export { dataSchema };

const col = (style: CSSProperties = {}): CSSProperties => ({
	display: "flex",
	flexDirection: "column",
	...style,
});

const row = (style: CSSProperties = {}): CSSProperties => ({
	display: "flex",
	flexDirection: "row",
	...style,
});

const text = (
	fontSize: number,
	fontWeight: number,
	lineHeight: number,
	style: CSSProperties = {},
): CSSProperties => ({
	display: "flex",
	fontFamily: FONT,
	fontSize,
	fontWeight,
	lineHeight: `${lineHeight}px`,
	color: "#000000",
	whiteSpace: "nowrap",
	...style,
});

// Same path as Figma's 33.87x40.31 vector (a down arrow); "up" is the same
// vector rotated 180 degrees, as in the design.
function Arrow({ up }: { up?: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={33.8679}
			height={40.308}
			viewBox="0 0 33.8679 40.308"
			fill="none"
			role="img"
			aria-label={up ? "max" : "min"}
			style={up ? { transform: "rotate(180deg)" } : undefined}
		>
			<path
				d="M33.1543 25.0873L18.6448 39.5968C18.4202 39.8222 18.1532 40.0011 17.8593 40.1231C17.5653 40.2452 17.2502 40.308 16.9319 40.308C16.6136 40.308 16.2985 40.2452 16.0046 40.1231C15.7106 40.0011 15.4437 39.8222 15.219 39.5968L0.709517 25.0873C0.255221 24.633 -6.76953e-09 24.0168 0 23.3744C6.76953e-09 22.7319 0.255221 22.1157 0.709517 21.6614C1.16381 21.2071 1.77997 20.9519 2.42244 20.9519C3.06491 20.9519 3.68107 21.2071 4.13536 21.6614L14.5157 32.0418V2.41825C14.5157 1.77689 14.7705 1.1618 15.224 0.708288C15.6775 0.254779 16.2926 0 16.9339 0C17.5753 0 18.1904 0.254779 18.6439 0.708288C19.0974 1.1618 19.3522 1.77689 19.3522 2.41825V32.0418L29.7325 21.6594C30.1868 21.2051 30.8029 20.9499 31.4454 20.9499C32.0879 20.9499 32.704 21.2051 33.1583 21.6594C33.6126 22.1137 33.8679 22.7299 33.8679 23.3723C33.8679 24.0148 33.6126 24.631 33.1583 25.0853L33.1543 25.0873Z"
				fill="#000000"
			/>
		</svg>
	);
}

// Figma polygon 31.18x27 inside a 36x36 box, rotated -90 degrees (points left).
// Coordinates below are that polygon after the rotation.
function Pointer() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={36}
			height={36}
			viewBox="0 0 36 36"
			fill="none"
			role="img"
			aria-label="current"
		>
			<path d="M0 18L27 33.5885L27 2.4115L0 18Z" fill="#000000" />
		</svg>
	);
}

const RAIN_TRACK_HEIGHT = 81;

function RainBar({ hour, barPx }: { hour: number; barPx: number }) {
	return (
		<div style={col({ width: 36, alignItems: "center", gap: 10 })}>
			<div
				style={col({
					width: 10,
					height: RAIN_TRACK_HEIGHT,
					justifyContent: "flex-end",
					backgroundColor: "#aaaaaa",
				})}
			>
				{barPx > 0 ? (
					<div
						style={{
							display: "flex",
							width: 10,
							height: barPx,
							backgroundColor: "#000000",
						}}
					/>
				) : null}
			</div>
			<div
				style={text(20, 400, 26, {
					width: 36,
					justifyContent: "center",
					color: "#777777",
				})}
			>
				{String(hour)}
			</div>
		</div>
	);
}

const DAY_BACKGROUNDS = [
	"#eeeeee",
	"#dddddd",
	"#cccccc",
	"#bbbbbb",
	"#aaaaaa",
	"#888888",
	"#777777",
];

// Takumi snaps text to whole pixels while the 7 rows are 153.14 px tall, so a
// row's label can land up to 1 px away from Figma's fractional position. Rows
// 1-4 need a 2 px nudge and rows 5-7 none to stay within 0.5 px of the design.
const LABEL_NUDGE = [2, 2, 2, 2, 0, 0, 0];

function DayRow({
	day,
	background,
	labelNudge,
}: {
	day: DashboardData["days"][number];
	background: string;
	labelNudge: number;
}) {
	return (
		<div
			style={row({
				flexGrow: 1,
				flexBasis: 0,
				width: "100%",
				alignItems: "center",
				justifyContent: "space-between",
				paddingLeft: 32,
				paddingRight: 32,
				backgroundColor: background,
			})}
		>
			<div style={text(32, 600, 42, { marginTop: labelNudge })}>
				{day.label}
			</div>
			<div style={row({ alignItems: "center", gap: 12 })}>
				{/* Figma: fixed 126 px box with the text centred in it, so a shorter
				    value ("9º/17º") stays centred instead of hugging the icon. */}
				<div
					style={text(32, 500, 42, {
						marginTop: 1,
						width: 126,
						justifyContent: "center",
					})}
				>
					{day.temps}
				</div>
				<SmallIcon name={day.icon} />
			</div>
		</div>
	);
}

function Room({ name, temp }: { name: string; temp: string }) {
	return (
		<div
			style={col({
				width: 176,
				height: 226,
				justifyContent: "flex-end",
				flexShrink: 0,
			})}
		>
			<div style={text(48, 300, 62)}>{name}</div>
			{/* Figma's text box is 192 px: 62 for the name and 130 for the value,
			    with the digits sitting in the lower 117 px of that 130. */}
			<div style={text(89.852, 400, 118, { marginTop: 12 })}>{temp}</div>
		</div>
	);
}

function Dashboard({ data }: { data: DashboardData }): ReactNode {
	return (
		<div
			style={row({
				width: DESIGN_WIDTH,
				height: DESIGN_HEIGHT,
				flexShrink: 0,
				backgroundColor: "#ffffff",
			})}
		>
			{/* Column 1: 650 px */}
			<div
				style={col({
					position: "relative",
					width: 650,
					height: DESIGN_HEIGHT,
					flexShrink: 0,
					overflow: "hidden",
					backgroundColor: "#ffffff",
				})}
			>
				{/* Icon + dial (458 px). The dial is a 592 px stack centred on the
				    block, so 23 and 25 are clipped. */}
				<div
					style={row({
						width: 650,
						height: 458,
						flexShrink: 0,
						alignItems: "center",
						justifyContent: "space-between",
						paddingLeft: 48,
						paddingRight: 26,
						overflow: "hidden",
					})}
				>
					<BigIcon name={data.icon} />
					<div
						style={col({
							width: 271,
							height: 592,
							flexShrink: 0,
							alignItems: "center",
							gap: 23,
						})}
					>
						{data.dial.map((n, i) => (
							<div
								key={`dial-${i}`}
								style={row({
									width: 271,
									height: 182,
									flexShrink: 0,
									alignItems: "center",
									justifyContent: "center",
								})}
							>
								<div style={text(240.222, 300, 181.492)}>{n}</div>
							</div>
						))}
					</div>
				</div>

				{/* min / max + date (386 px) */}
				<div style={row({ width: 650, height: 386, flexShrink: 0 })}>
					<div
						style={col({
							width: 325,
							height: 386,
							flexShrink: 0,
							alignItems: "center",
							justifyContent: "center",
							gap: 10,
							backgroundColor: "#eeeeee",
						})}
					>
						<div style={row({ alignItems: "center", gap: 14 })}>
							<Arrow />
							<div style={text(81.067, 300, 105)}>{data.min}</div>
						</div>
						<div style={row({ alignItems: "center", gap: 14 })}>
							<Arrow up />
							<div style={text(81.067, 300, 105)}>{data.max}</div>
						</div>
					</div>
					<div
						style={col({
							width: 325,
							height: 386,
							flexShrink: 0,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: "#dddddd",
						})}
					>
						<div style={col({ alignItems: "flex-start" })}>
							<div style={text(36, 400, 45, { marginTop: 1 })}>
								{data.month}
							</div>
							<div style={text(164.4, 300, 169, { marginBottom: -1 })}>
								{data.day}
							</div>
						</div>
					</div>
				</div>

				{/* rain chart (228 px) */}
				<div
					style={col({
						width: 650,
						height: 228,
						flexShrink: 0,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "#cccccc",
					})}
				>
					<div style={row({ gap: 8, alignItems: "center" })}>
						{data.rain.map((bar) => (
							<RainBar key={bar.hour} hour={bar.hour} barPx={bar.barPx} />
						))}
					</div>
				</div>

				{/* decorative pointer on the dial's current value */}
				<div
					style={{ position: "absolute", left: 629, top: 212, display: "flex" }}
				>
					<Pointer />
				</div>
			</div>

			{/* Column 2: 473 px, seven day rows */}
			<div
				style={col({
					width: 473,
					height: DESIGN_HEIGHT,
					flexShrink: 0,
				})}
			>
				{data.days.map((day, i) => (
					<DayRow
						key={day.label}
						day={day}
						background={DAY_BACKGROUNDS[i] ?? "#777777"}
						labelNudge={LABEL_NUDGE[i] ?? 0}
					/>
				))}
			</div>

			{/* Column 3: 325 px, rooms */}
			<div
				style={col({
					width: 325,
					height: DESIGN_HEIGHT,
					flexShrink: 0,
					alignItems: "center",
					justifyContent: "space-between",
					paddingTop: 40,
					paddingBottom: 40,
					backgroundColor: "#ffffff",
				})}
			>
				{data.rooms.map((room) => (
					<Room key={room.name} name={room.name} temp={room.temp} />
				))}
			</div>
		</div>
	);
}

export default function KindleDashboard({
	width = DESIGN_WIDTH,
	height = DESIGN_HEIGHT,
	screen,
	data,
}: {
	width?: number;
	height?: number;
	screen?: ScreenProfile;
	data: DashboardData;
}) {
	// The rasterizer stretches the logical canvas (width x height) to the
	// physical image. For the Voyage the logical canvas is smaller than
	// 1448x1072, so draw the 1448x1072 page and shrink it by the inverse of that
	// stretch; the two cancel and the page lands 1:1 on the physical pixels.
	const physicalWidth = screen?.physicalWidth ?? DESIGN_WIDTH;
	const physicalHeight = screen?.physicalHeight ?? DESIGN_HEIGHT;
	const scaleX = width / physicalWidth;
	const scaleY = height / physicalHeight;
	const needsCompensation = scaleX !== 1 || scaleY !== 1;

	return (
		<div
			style={{
				display: "flex",
				width,
				height,
				overflow: "hidden",
				backgroundColor: "#ffffff",
			}}
		>
			{needsCompensation ? (
				<div
					style={{
						display: "flex",
						width: DESIGN_WIDTH,
						height: DESIGN_HEIGHT,
						flexShrink: 0,
						transform: `scale(${scaleX}, ${scaleY})`,
						transformOrigin: "top left",
					}}
				>
					<Dashboard data={data} />
				</div>
			) : (
				<Dashboard data={data} />
			)}
		</div>
	);
}

export const definition: RecipeDefinition<
	typeof paramsSchema,
	typeof dataSchema
> = {
	meta: {
		slug: "kindle-dashboard",
		title: "Kindle dashboard",
		description:
			"Home dashboard for the Kindle Voyage: weather (Open-Meteo), rain, 7 days and room temperatures (Home Assistant).",
		published: true,
		category: "display-components",
		version: "0.2.0",
	},
	paramsSchema,
	dataSchema,
	getData: () => getData(),
	Component: ({ width, height, screen, data }) => (
		<KindleDashboard
			width={width}
			height={height}
			screen={screen}
			data={data}
		/>
	),
};
