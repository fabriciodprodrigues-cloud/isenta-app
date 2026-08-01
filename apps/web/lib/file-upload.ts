// Utilities para upload de arquivos
// Nota: implementação real de R2 virá na próxima etapa
// Por enquanto, salvamos em memória/temp

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

interface FileValidationError {
  ok: false;
  error: string;
}

interface FileValidationSuccess {
  ok: true;
}

export function validate_file(file: File): FileValidationError | FileValidationSuccess {
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `Arquivo muito grande. Máximo: 10MB (atual: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: 'Tipo de arquivo não suportado. Use PDF, JPG ou PNG',
    };
  }

  return { ok: true };
}

// Gerar nome de arquivo seguro
export function generate_filename(file: File, prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  return `${prefix}-${timestamp}-${random}.${ext}`;
}

// Converter File para base64 (para demo)
export async function file_to_base64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
  });
}
