<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

// --- Состояния ---
const videoRef = ref<HTMLVideoElement | null>(null);
const controls = ref<IScannerControls | null>(null);
const codeReader = ref<BrowserMultiFormatReader | null>(null);
const devices = ref<MediaDeviceInfo[]>([]);
const selectedDeviceId = ref<string | null>(null);
const running = ref(false);
const hasTorch = ref(false);
const torchOn = ref(false);
const lastScannedText = ref<string | null>(null);
const successPulse = ref(false);
const showSnack = ref(false);
const snackTimer = ref<number | null>(null);
const pulseCooldownMs = 900;
const snackDurationMs = 2200;
let lastPulseAt = 0;

// --- ZXing ---
function createReader() {
  const hints = new Map<DecodeHintType, any>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  return new BrowserMultiFormatReader(hints);
}

function beep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => ctx.close();
  } catch {}
}

function triggerSuccessUI(text: string) {
  const now = Date.now();
  if (text === lastScannedText.value && now - lastPulseAt < pulseCooldownMs)
    return;
  lastScannedText.value = text;
  lastPulseAt = now;

  successPulse.value = false;
  requestAnimationFrame(() => (successPulse.value = true));
  setTimeout(() => (successPulse.value = false), 420);

  if (navigator.vibrate) navigator.vibrate([18, 30]);
  beep();

  if (snackTimer.value) {
    window.clearTimeout(snackTimer.value);
    snackTimer.value = null;
  }
  showSnack.value = true;
  snackTimer.value = window.setTimeout(
    () => (showSnack.value = false),
    snackDurationMs
  );
}

async function listCameras() {
  const all = await BrowserMultiFormatReader.listVideoInputDevices();
  devices.value = all;
  if (!selectedDeviceId.value && devices.value.length)
    selectedDeviceId.value = devices.value[0].deviceId;
}

async function startScanner() {
  if (running.value || !videoRef.value) return;
  if (!codeReader.value) codeReader.value = createReader();
  const devId = selectedDeviceId.value ?? undefined;

  controls.value = await codeReader.value.decodeFromVideoDevice(
    devId,
    videoRef.value,
    (result, err) => {
      if (result) triggerSuccessUI(result.getText());
    }
  );
  running.value = true;

  const stream = (videoRef.value as any)?.srcObject as MediaStream | undefined;
  const track = stream?.getVideoTracks?.()[0];
  const caps = track?.getCapabilities?.();
  hasTorch.value = Boolean(caps && 'torch' in caps);
}

function stopScanner() {
  controls.value?.stop?.();
  controls.value = null;
  codeReader.value = null;
  running.value = false;
  hasTorch.value = false;
  torchOn.value = false;
}

async function toggleTorch() {
  const stream = (videoRef.value as any)?.srcObject as MediaStream | undefined;
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return;
  const caps: any = track.getCapabilities?.();
  if (!caps || !('torch' in caps)) return;
  torchOn.value = !torchOn.value;
  await track.applyConstraints({ advanced: [{ torch: torchOn.value }] as any });
}

// --- Lifecycle ---
onMounted(async () => {
  await listCameras();
  startScanner();
});
onBeforeUnmount(() => stopScanner());

watch(selectedDeviceId, async () => {
  if (!running.value) return;
  stopScanner();
  await startScanner();
});
</script>

<template>
  <div class="flex flex-col gap-3 p-4 bg-gray-100 min-h-screen">
    <h2 class="text-3xl font-bold text-center">QR Scanner Test</h2>

    <div
      class="relative w-full max-w-md mx-auto aspect-square bg-black rounded-lg overflow-hidden shadow-lg"
    >
      <video
        ref="videoRef"
        autoplay
        muted
        playsinline
        class="w-full h-full object-cover"
      ></video>
      <div
        class="absolute inset-0 bg-green-400/25 rounded-xl opacity-0 transition-opacity"
        :class="{ 'opacity-100': successPulse }"
      ></div>
    </div>

    <div class="max-w-md mx-auto flex flex-wrap items-center gap-2 mt-4">
      <select v-model="selectedDeviceId" class="border rounded px-2 py-1">
        <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">
          {{ d.label || d.deviceId }}
        </option>
      </select>

      <button
        class="px-4 py-2 bg-green-500 text-white rounded"
        @click="startScanner"
      >
        Start
      </button>
      <button
        class="px-4 py-2 bg-red-500 text-white rounded"
        @click="stopScanner"
      >
        Stop
      </button>
      <button
        v-if="hasTorch"
        class="px-4 py-2 bg-yellow-500 text-white rounded"
        @click="toggleTorch"
      >
        {{ torchOn ? 'Torch off' : 'Torch on' }}
      </button>
    </div>

    <div
      v-if="showSnack"
      class="mt-2 text-center p-2 bg-gray-900 text-white rounded"
    >
      Scanned: {{ lastScannedText }}
    </div>
  </div>
</template>

<style scoped>
/* базовые стили для кнопок */
button {
  cursor: pointer;
}
</style>
