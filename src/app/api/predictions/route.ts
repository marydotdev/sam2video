import Replicate from "replicate";
import { NextResponse } from "next/server";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const data = await req.formData();
  const file = data.get("video") as File;
  const clickCoordinates = JSON.parse(data.get("click_coordinates") as string);
  const clickObjectIds = data.get("click_object_ids") as string;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // Convert file to base64
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  const mimeType = file.type;
  const dataUri = `data:${mimeType};base64,${base64}`;

  try {
    const prediction = await replicate.predictions.create({
      version:
        "33432afdfc06a10da6b4018932893d39b0159f838b6d11dd1236dff85cc5ec1d",
      input: {
        mask_type: "highlighted",
        video_fps: 25,
        input_video: dataUri,
        click_frames: "1",
        output_video: true,
        click_object_ids: clickObjectIds,
        click_coordinates: clickCoordinates
          .map(([x, y]: [number, number]) => `[${x},${y}]`)
          .join(","),
      },
    });

    return NextResponse.json(prediction, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
