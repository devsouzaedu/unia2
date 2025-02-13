import { NextResponse } from "next/server";
import Replicate from "replicate";
import FormData from "form-data";
import fetch from "node-fetch";

// Função auxiliar para converter um ReadableStream em Buffer
async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  try {
    console.log("Receiving image request...");

    const formData = await request.formData();
    const image = formData.get("image");
    const userPrompt = formData.get("prompt")?.toString() || "";

    if (!image || !(image instanceof File)) {
      console.error("No image was sent or the file type is invalid.");
      return NextResponse.json(
        { error: "No image was sent or the file type is invalid." },
        { status: 400 }
      );
    }

    console.log("Image received successfully, converting to base64...");
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;

    // Novo finalPrompt que mescla a entrada do usuário com instruções fixas
    const finalPrompt = `Using the submitted hand photo, modify only the nail polish on the five nails. DO NOT change any part of the hand (including skin tone, texture, or details). Apply the following design exclusively to the nails: ${userPrompt}. The hand must remain exactly as in the original photo.`;
    console.log("Final prompt:", finalPrompt);

    console.log("Sending the image to the ControlNet model...");
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const outputRaw: unknown = await replicate.run(
      "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613",
      {
        input: {
          image: base64Image,
          prompt: finalPrompt,
          // Negative prompt reforçado para evitar que a mão seja alterada
          negative_prompt: "hand, skin, face, full body, background, non-nail areas",
          guidance_scale: 1,
          num_outputs: 1,
        },
      }
    );

    console.log("Replicate response (outputRaw):", outputRaw);

    // Converter o output recebido para um array de Buffer
    let output: Buffer[] = [];

    if (
      Array.isArray(outputRaw) &&
      outputRaw.length > 0 &&
      typeof (outputRaw[0] as any).getReader === "function"
    ) {
      // Se for um array de ReadableStream, converte cada stream em Buffer
      output = await Promise.all(
        (outputRaw as ReadableStream[]).map(async (stream) => {
          return await streamToBuffer(stream);
        })
      );
    } else if (typeof outputRaw === "string") {
      output = [Buffer.from(outputRaw, "binary")];
    } else if (Array.isArray(outputRaw) && typeof outputRaw[0] === "string") {
      output = (outputRaw as string[]).map((s) => Buffer.from(s, "binary"));
    } else if (
      typeof outputRaw === "object" &&
      outputRaw !== null &&
      "output" in outputRaw
    ) {
      const maybeOutput = (outputRaw as any).output;
      if (Array.isArray(maybeOutput) && typeof maybeOutput[0] === "string") {
        output = maybeOutput.map((s: string) => Buffer.from(s, "binary"));
      } else {
        throw new Error(
          "Unexpected output format: 'output' property is not an array of strings"
        );
      }
    } else {
      throw new Error("Unexpected output format");
    }

    console.log("Expected format confirmed. Output length:", output.length);

    // Se receber mais de uma imagem, escolhe a de maior tamanho (em bytes)
    let chosenBuffer: Buffer;
    if (output.length > 1) {
      chosenBuffer = output.reduce((prev, curr) =>
        curr.length > prev.length ? curr : prev
      );
    } else {
      chosenBuffer = output[0];
    }

    console.log("Chosen buffer for upload, size:", chosenBuffer.length);
    console.log("Uploading the image to Cloudinary...");

    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", chosenBuffer, "nail.png");
    cloudinaryForm.append(
      "upload_preset",
      process.env.CLOUDINARY_UPLOAD_PRESET!
    );

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: cloudinaryForm,
      }
    );

    const uploadResult = await uploadResponse.json();
    console.log("Cloudinary response:", uploadResult);

    // Return only the URL of the chosen image
    return NextResponse.json({ urls: [uploadResult.secure_url] });
  } catch (error) {
    console.error("Unexpected server error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
