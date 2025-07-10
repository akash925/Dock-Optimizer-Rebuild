export async function uploadViaS3Post(
  url: string,
  fields: Record<string, string>,
  file: File
) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: 'POST', body: form });
    if (res.ok) return;
    await new Promise(r => setTimeout(r, attempt * 300));
  }
  throw new Error('S3 upload failed after 3 attempts');
} 