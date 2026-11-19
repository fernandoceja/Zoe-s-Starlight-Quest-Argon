#!/usr/bin/env node
/**
 * Zoe's Starlight Quest — Offline Build-Time Gemini TTS Generator
 * ----------------------------------------------------------------------------
 * Pre-generates static audio clips using `gemini-2.5-flash-preview-tts` and
 * official prebuilt voices. Never imported by client code, never called at
 * runtime, and never embeds any API key in the app bundle.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/generate-tts.mjs --sample
 *   GEMINI_API_KEY=... node scripts/generate-tts.mjs --all
 *
 * Options:
 *   --sample        Generate only the 4 audition clips into assets/audio/tts-sample/
 *   --all           Generate full quest script into assets/audio/tts/ (after approval)
 *   --delay=<ms>    Delay between API requests to stay within free-tier RPM (default: 4500)
 *   --force         Overwrite existing clips instead of skipping them
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { TTS_MODEL, VOICE_CAST, SAMPLE_LINES } from './tts-cast.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Wrap raw 16-bit mono PCM (24kHz default) in a standard 44-byte RIFF WAV header. */
function pcmToWav(pcmBuf, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuf.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuf.length, 40);
  return Buffer.concat([header, pcmBuf]);
}

function parseSampleRate(mimeType = '') {
  const m = String(mimeType).match(/rate=(\d+)/i);
  return m ? Number(m[1]) : 24000;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function saveAudioFile(wavBuf, outDir, clipId, useMp3) {
  fs.mkdirSync(outDir, { recursive: true });
  const wavPath = path.join(outDir, `${clipId}.wav`);

  if (useMp3) {
    const tmpWav = path.join(outDir, `.${clipId}.tmp.wav`);
    const mp3Path = path.join(outDir, `${clipId}.mp3`);
    fs.writeFileSync(tmpWav, wavBuf);
    try {
      execFileSync(
        'ffmpeg',
        ['-y', '-i', tmpWav, '-ac', '1', '-ar', '24000', '-b:a', '64k', mp3Path],
        { stdio: 'ignore' }
      );
      fs.unlinkSync(tmpWav);
      return { filePath: mp3Path, ext: 'mp3', bytes: fs.statSync(mp3Path).size };
    } catch {
      if (fs.existsSync(tmpWav)) fs.renameSync(tmpWav, wavPath);
      return { filePath: wavPath, ext: 'wav', bytes: fs.statSync(wavPath).size };
    }
  }

  fs.writeFileSync(wavPath, wavBuf);
  return { filePath: wavPath, ext: 'wav', bytes: wavBuf.length };
}

export async function generateSampleClips({
  apiKey = process.env.GEMINI_API_KEY,
  force = false,
  requestDelayMs = 4500,
} = {}) {
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set in the environment. Configure GEMINI_API_KEY in Settings > Secrets (or pass GEMINI_API_KEY=... in your local shell).'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const useMp3 = hasFfmpeg();
  const outDir = path.join(ROOT, 'assets', 'audio', 'tts-sample');
  fs.mkdirSync(outDir, { recursive: true });

  let rateLimitHits = 0;

  async function synthesizeClip(line) {
    const cast = VOICE_CAST[line.character];
    if (!cast) throw new Error(`Unknown character in cast: ${line.character}`);

    const prompt = `${cast.stylePrompt}\n\nRead aloud warmly and naturally (say only the exact words below, nothing extra):\n"${line.text}"`;

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: TTS_MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: cast.voiceName },
              },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part?.inlineData?.data) {
          throw new Error(`No audio inlineData returned for ${line.id}`);
        }

        const rawBuf = Buffer.from(part.inlineData.data, 'base64');
        const mimeType = part.inlineData.mimeType || '';
        const isWav =
          rawBuf.length >= 12 &&
          rawBuf.subarray(0, 4).toString('ascii') === 'RIFF' &&
          rawBuf.subarray(8, 12).toString('ascii') === 'WAVE';

        const wavBuf = isWav ? rawBuf : pcmToWav(rawBuf, parseSampleRate(mimeType));
        return { wavBuf, mimeType, voiceName: cast.voiceName };
      } catch (err) {
        const msg = String(err?.message || err);
        const isRateLimit = /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
        if (isRateLimit) rateLimitHits++;
        if (attempt < maxAttempts && (isRateLimit || /500|503|unavailable|timeout/i.test(msg))) {
          const waitMs = Math.min(60000, 6000 * Math.pow(2, attempt - 1));
          console.warn(
            `[${line.id}] ${isRateLimit ? 'Rate limit (429)' : 'Transient error'} on attempt ${attempt}/${maxAttempts}; retrying in ${(waitMs / 1000).toFixed(1)}s...`
          );
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }
  }

  console.log(
    `Generating ${SAMPLE_LINES.length} sample clips with ${TTS_MODEL} (${useMp3 ? 'MP3 64kbps mono' : 'WAV 24kHz mono'})...`
  );
  const results = [];
  let totalBytes = 0;

  for (let i = 0; i < SAMPLE_LINES.length; i++) {
    const line = SAMPLE_LINES[i];
    const targetExt = useMp3 ? 'mp3' : 'wav';
    const existingPath = path.join(outDir, `${line.id}.${targetExt}`);

    if (!force && fs.existsSync(existingPath)) {
      const bytes = fs.statSync(existingPath).size;
      totalBytes += bytes;
      results.push({
        ...line,
        voiceName: VOICE_CAST[line.character].voiceName,
        file: `assets/audio/tts-sample/${line.id}.${targetExt}`,
        bytes,
        skipped: true,
      });
      console.log(`  [skip] ${line.id}.${targetExt} (${(bytes / 1024).toFixed(1)} KB)`);
      continue;
    }

    const { wavBuf, voiceName } = await synthesizeClip(line);
    const saved = saveAudioFile(wavBuf, outDir, line.id, useMp3);
    totalBytes += saved.bytes;
    results.push({
      ...line,
      voiceName,
      file: `assets/audio/tts-sample/${line.id}.${saved.ext}`,
      bytes: saved.bytes,
    });
    console.log(
      `  [ok]   ${line.id}.${saved.ext} (${voiceName}) — ${(saved.bytes / 1024).toFixed(1)} KB`
    );

    if (i < SAMPLE_LINES.length - 1 && requestDelayMs > 0) {
      await sleep(requestDelayMs);
    }
  }

  const manifest = {
    model: TTS_MODEL,
    generatedAt: new Date().toISOString(),
    clipCount: results.length,
    totalBytes,
    rateLimitHits,
    clips: results,
  };

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\nDone! ${results.length} clips saved to assets/audio/tts-sample/`);
  console.log(`Total size: ${(totalBytes / 1024).toFixed(1)} KB (${totalBytes} bytes)`);
  console.log(`Free-tier rate limit retries hit: ${rateLimitHits}`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const isSample = args.includes('--sample') || !args.includes('--all');
  const force = args.includes('--force');
  const delayArg = args.find((a) => a.startsWith('--delay='));
  const requestDelayMs = delayArg ? Math.max(0, Number(delayArg.split('=')[1]) || 0) : 4500;

  if (!isSample) {
    console.error(
      'Full-script generation (--all) is intentionally gated until you listen to and approve the sample clips in assets/audio/tts-sample/.'
    );
    process.exit(1);
  }

  generateSampleClips({ force, requestDelayMs }).catch((err) => {
    console.error('TTS generation failed:', err?.message || err);
    process.exit(1);
  });
}
