// Icon names shared by the data layer (no JSX) and the renderer.
export const ICON_NAMES = [
	"sun",
	"cloud-sun",
	"cloud",
	"cloud-fog",
	"cloud-rain",
	"cloud-lightning",
	"snowflake",
	"moon",
	"cloud-moon",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
