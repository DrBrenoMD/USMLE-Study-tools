import JSZip from 'jszip';
import {
  EXTENSION_NAME,
  EXTENSION_VERSION,
  manifestJson,
  popupHtml,
  popupJs,
  contentJs,
  readmeTxt
} from '../extension_source/extensionFiles';

export async function downloadExtensionZip(): Promise<void> {
  const zip = new JSZip();

  zip.file('manifest.json', manifestJson);
  zip.file('popup.html', popupHtml);
  zip.file('popup.js', popupJs);
  zip.file('content.js', contentJs);
  zip.file('LEIA-ME_Instalacao.txt', readmeTxt);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `Assistente-UWorld-Pacer-v${EXTENSION_VERSION}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
