import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const zipPath = path.join(process.cwd(), "download", "caec-tenis-dashboard.zip");
    const fileBuffer = await fs.readFile(zipPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=\"caec-tenis-dashboard.zip\"",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 }
    );
  }
}
