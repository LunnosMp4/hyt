import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

const TEMPLATE_URL = 'https://github.com/hytale-france/example-mod/archive/refs/tags/v0.0.2-HY%232026.01.13-50e69c385.zip';
const CFR_URL = 'https://www.benf.org/other/cfr/cfr-0.152.jar';

/** Download a file from URL to destination with progress bar */
export async function downloadFile(url: string, destPath: string, maxRedirects = 10): Promise<void> {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects (301, 302, 307, 308)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // Resolve relative URLs
          const resolvedUrl = redirectUrl.startsWith('http') 
            ? redirectUrl 
            : new URL(redirectUrl, url).toString();
          
          downloadFile(resolvedUrl, destPath, maxRedirects - 1).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      
      // Create progress bar - output to stderr to avoid conflicts with spinners
      const progressBar = new cliProgress.SingleBar({
        format: '{filename} |{bar}| {percentage}% || {value}/{total} bytes || ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        etaBuffer: 10,
        stream: process.stderr,
      } as any);

      if (contentLength > 0) {
        progressBar.start(contentLength, 0, {
          filename: path.basename(destPath),
        });
      }

      const fileStream = createWriteStream(destPath);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (contentLength > 0) {
          progressBar.update(downloadedBytes);
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        if (contentLength > 0) {
          progressBar.stop();
          // Clear the line to prevent overlap with next output
          process.stderr.write('\n');
        }
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        if (contentLength > 0) {
          progressBar.stop();
          process.stderr.write('\n');
        }
        fs.unlink(destPath).catch(() => {}); // Clean up partial file
        reject(err);
      });
    });

    request.on('error', reject);
  });
}

/** Download the example plugin template */
export async function downloadTemplate(destPath: string): Promise<void> {
  await downloadFile(TEMPLATE_URL, destPath);
}

/** Download CFR decompiler */
export async function downloadCfr(destPath: string): Promise<void> {
  await downloadFile(CFR_URL, destPath);
}

export function getTemplateUrl(): string {
  return TEMPLATE_URL;
}

export function getCfrUrl(): string {
  return CFR_URL;
}
