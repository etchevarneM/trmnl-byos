/// <reference types="jest" />
import sharp from "sharp";
import type { DeviceProfile } from "@/lib/trmnl/types";
import { renderDeviceImage } from "./device-image";

const GRAY_256 = { id: "gray-256", name: "256 Grays (8-bit)", grays: 256 };

function profileFor(
	width: number,
	height: number,
	rotation: number,
	palette: DeviceProfile["palette"] = null,
): DeviceProfile {
	return {
		model: {
			name: "test_model",
			label: "Test model",
			width,
			height,
			colors: 256,
			bit_depth: 8,
			scale_factor: 1,
			rotation,
			mime_type: "image/png",
			offset_x: 0,
			offset_y: 0,
			palette_ids: [],
			image_size_limit: undefined,
		},
		palette,
	};
}

async function blankPng(width: number, height: number): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 3, background: "#ffffff" },
	})
		.png()
		.toBuffer();
}

async function outputSize(profile: DeviceProfile, png: Buffer) {
	const { buffer } = await renderDeviceImage({ png, profile });
	const { width, height } = await sharp(buffer).metadata();
	return { width, height };
}

describe("renderDeviceImage canvas size", () => {
	it("swaps width and height for a 90° model such as the Kindle Voyage", async () => {
		const profile = profileFor(1448, 1072, 90);

		expect(await outputSize(profile, await blankPng(1448, 1072))).toEqual({
			width: 1072,
			height: 1448,
		});
		expect(await outputSize(profile, await blankPng(800, 480))).toEqual({
			width: 1072,
			height: 1448,
		});
	});

	it("encodes 256-gray PNG targets as a plain 1-channel 8-bit gray PNG", async () => {
		const profile = profileFor(256, 4, 0, GRAY_256);
		const ramp = Buffer.alloc(256 * 4 * 3);
		for (let i = 0; i < 256 * 4; i++) {
			ramp.fill(i % 256, i * 3, i * 3 + 3);
		}
		const png = await sharp(ramp, {
			raw: { width: 256, height: 4, channels: 3 },
		})
			.png()
			.toBuffer();

		const { buffer } = await renderDeviceImage({ png, profile });

		// IHDR: bit depth at byte 24, color type at 25, interlace at 28.
		expect(buffer[24]).toBe(8);
		expect(buffer[25]).toBe(0);
		expect(buffer[28]).toBe(0);
		expect(buffer.includes(Buffer.from("PLTE"))).toBe(false);

		const { data, info } = await sharp(buffer)
			.raw()
			.toBuffer({ resolveWithObject: true });
		expect(info.width).toBe(256);
		expect(info.height).toBe(4);
		for (let x = 0; x < 256; x++) {
			expect(data[x * info.channels]).toBe(x);
		}
	});

	it("keeps the model size when there is no rotation", async () => {
		expect(
			await outputSize(profileFor(800, 480, 0), await blankPng(800, 480)),
		).toEqual({ width: 800, height: 480 });
	});
});
