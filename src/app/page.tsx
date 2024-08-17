"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [prediction, setPrediction] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [clickCoordinates, setClickCoordinates] = useState<[number, number][]>(
    []
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const drawDot = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, label: string) => {
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
    },
    []
  );

  const drawVideoFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Redraw existing dots
        clickCoordinates.forEach((coord, index) => {
          drawDot(ctx, coord[0], coord[1], `${index + 1}`);
        });
      }
    }
  }, [clickCoordinates, drawDot]);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [videoFile]);

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      const video = videoRef.current;
      video.src = videoUrl;
      video.onloadedmetadata = () => {
        video.currentTime = 0; // Set to the first frame
      };
      video.onseeked = () => {
        drawVideoFrame();
      };
    }
  }, [videoUrl, drawVideoFrame]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setClickCoordinates([]);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      setClickCoordinates((prev) => {
        const newCoordinates: [number, number][] = [...prev, [x, y]];
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawDot(ctx, x, y, `${newCoordinates.length}`);
        }
        return newCoordinates;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!videoFile || clickCoordinates.length === 0) {
      setError("Please upload a video and select at least one object");
      return;
    }

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("click_coordinates", JSON.stringify(clickCoordinates));
    formData.append(
      "click_object_ids",
      clickCoordinates.map((_, i) => `object_${i + 1}`).join(",")
    );

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        body: formData,
      });

      let prediction = await response.json();
      if (response.status !== 201) {
        setError(prediction.detail);
        return;
      }
      setPrediction(prediction);

      while (
        prediction.status !== "succeeded" &&
        prediction.status !== "failed"
      ) {
        await sleep(1000);
        const response = await fetch("/api/predictions/" + prediction.id);
        prediction = await response.json();
        if (response.status !== 200) {
          setError(prediction.detail);
          return;
        }
        console.log({ prediction });
        setPrediction(prediction);
      }
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred while processing your request.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <div className="flex flex-col z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex bg-white p-10 border-solid border-2 border-gray-300 rounded-3xl">
        <Head>
          <title>SAM 2 Video with Next.js</title>
        </Head>

        <h1 className="text-2xl font-bold mb-4">SAM 2 Video Segmentation</h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full"
        >
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="mb-4"
          />
          {videoUrl && (
            <div className="mb-4">
              <p className="mb-2">Click on objects to select them:</p>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{
                  border: "1px solid black",
                  cursor: "crosshair",
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
              <video
                ref={videoRef}
                style={{ display: "none" }}
                muted
                playsInline
              />
            </div>
          )}
          <button
            type="submit"
            className="px-4 py-2 mt-4 w-full bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!videoFile || clickCoordinates.length === 0}
          >
            Process Video
          </button>
        </form>

        {error && <div className="mt-4 text-red-500">{error}</div>}

        {prediction && (
          <div className="mt-4">
            <p className="mt-4 text-lg text-gray-700">
              Status: {prediction.status}
            </p>
            {prediction.status === "succeeded" && (
              <div className="flex flex-col items-center justify-center w-full mt-4">
                <video
                  controls
                  autoPlay
                  width="500"
                  className="rounded-md border border-gray-300"
                  key={prediction.output} // Force video reload when src changes
                >
                  <source src={prediction.output} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
