import { NextResponse } from "next/server";
import { backendUrl } from "../../../../lib/backend-url";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function errorResponse(message, status = 400, details = []) {
  return NextResponse.json({ error: message, errors: details }, { status });
}

export async function POST(request) {
  const formData = await request.formData();
  const useSample = formData.get("sample") === "1";
  const uploadFile = formData.get("bookingFile");

  try {
    let content = "";
    let fileName = "booking-upload.csv";
    if (useSample) {
      const templateResponse = await fetch(backendUrl("api/admin/bookings/template"), {
        cache: "no-store",
        headers: { cookie: request.headers.get("cookie") || "" }
      });
      if (!templateResponse.ok) throw new Error("Unable to load the sample booking template.");
      content = await templateResponse.text();
      fileName = "sample-booking-upload.csv";
    } else if (uploadFile && typeof uploadFile.text === "function" && uploadFile.size > 0) {
      if (uploadFile.size > MAX_FILE_SIZE) return errorResponse("The upload must be 5 MB or smaller.");
      if (!uploadFile.name?.toLowerCase().endsWith(".csv")) return errorResponse("Use a .csv booking-upload file.");
      content = await uploadFile.text();
      fileName = uploadFile.name || fileName;
    } else {
      return errorResponse("Choose a booking CSV file before uploading.");
    }

    const response = await fetch(backendUrl("api/admin/bookings/import"), {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") || "" },
      body: JSON.stringify({ fileName, content })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const firstError = result.errors?.[0];
      return errorResponse(
        firstError ? `${firstError.columnName}: ${firstError.errorMessage}` : result.error || "Booking upload failed.",
        response.status,
        result.errors || []
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error.message || "Booking upload failed.");
  }
}
