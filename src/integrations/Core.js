// Reemplaza el módulo virtual @/integrations/Core de Base44.
import { apiFetch } from '@/api/client';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function UploadFile({ file }) {
  const data = await fileToBase64(file);
  return apiFetch('/files', {
    method: 'POST',
    body: { name: file.name, type: file.type, size: file.size, data },
  });
}

// Integraciones de Base44 que esta app no usa; quedan como aviso claro por si
// algún código nuevo las invoca.
const noDisponible = (nombre) => () => {
  throw new Error(`La integración ${nombre} no está disponible fuera de Base44`);
};

export const InvokeLLM = noDisponible('InvokeLLM');
export const SendEmail = noDisponible('SendEmail');
export const GenerateImage = noDisponible('GenerateImage');
export const ExtractDataFromUploadedFile = noDisponible('ExtractDataFromUploadedFile');
export const CreateFileSignedUrl = noDisponible('CreateFileSignedUrl');
export const UploadPrivateFile = noDisponible('UploadPrivateFile');
