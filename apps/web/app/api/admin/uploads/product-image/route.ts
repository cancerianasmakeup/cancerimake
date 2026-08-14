import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createSupabaseServerForStore, storeIdFromRequest } from "@/lib/supabase-server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

function env(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPublicUrl(baseUrl: string, key: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${normalizedBase}/${encodedKey}`;
}

export async function POST(request: Request) {
  try {
    // La cookie de tienda tiene path=/admin y acá no llega: el cliente manda la
    // tienda en x-store-id. Sin esto, subir una foto desde Mar del Plata se
    // validaría contra la base de Buenos Aires.
    const supabase = await createSupabaseServerForStore(storeIdFromRequest(request));
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticada" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "No tenes permisos de admin" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se permiten imagenes" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "La imagen supera 8MB" }, { status: 400 });
    }

    const accountId = env("CLOUDFLARE_ACCOUNT_ID");
    const accessKeyId = env("CLOUDFLARE_R2_ACCESS_KEY_ID");
    const secretAccessKey = env("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    const bucket = env("CLOUDFLARE_R2_BUCKET");
    const publicBaseUrl = env("CLOUDFLARE_R2_PUBLIC_BASE_URL");
    const prefix = (process.env.CLOUDFLARE_R2_PRODUCTS_PREFIX || "CANCERIANAS PRODUCTOS")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const originalName = sanitizeFileName(file.name) || "image";
    const key = `${prefix}/${Date.now()}-${originalName}`;
    const body = Buffer.from(await file.arrayBuffer());

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const url = buildPublicUrl(publicBaseUrl, key);
    return NextResponse.json({ url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error subiendo imagen" },
      { status: 500 }
    );
  }
}
