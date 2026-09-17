<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import { entriesApi, parsePhotos, type PhotoMeta } from '@/api/entries';
import { compressImage, getPhotoUrl, revokePhotoUrl } from '@/lib/photo';

const props = withDefaults(defineProps<{
  entryId: number;
  photosJson: string;
  editable?: boolean;
  compact?: boolean;
}>(), { editable: false, compact: false });

const emit = defineEmits<{ (e: 'changed', photos: PhotoMeta[]): void }>();

const photos = ref<PhotoMeta[]>([]);
const urls = ref<Record<string, string>>({});
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const previewIndex = ref(-1);

watch(() => props.photosJson, async (v) => { await sync(v); }, { immediate: true });

async function sync(override?: string) {
  const metas = parsePhotos(override ?? props.photosJson);
  photos.value = metas;
  const next: Record<string, string> = {};
  const oldIds = Object.keys(urls.value);
  await Promise.all(
    metas.map(async (p) => {
      try { next[p.id] = await getPhotoUrl(props.entryId, p.id); } catch { /* 图片加载失败静默 */ }
    })
  );
  urls.value = next;
  for (const id of oldIds) {
    if (!metas.some((m) => m.id === id)) revokePhotoUrl(props.entryId, id);
  }
}

const previewList = ref<string[]>([]);
watch(photos, () => { previewList.value = photos.value.map((p) => urls.value[p.id]).filter(Boolean); }, { deep: true });
watch(urls, () => { previewList.value = photos.value.map((p) => urls.value[p.id]).filter(Boolean); }, { deep: true });

function pickFiles() { fileInput.value?.click(); }

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  if (!files.length) return;

  const remain = 9 - photos.value.length;
  if (files.length > remain) {
    ElMessage.warning(`每条记录最多 9 张，本次将只上传前 ${remain} 张`);
  }
  const queue = files.slice(0, Math.max(0, remain));
  uploading.value = true;
  try {
    for (const f of queue) {
      try {
        const dataUrl = await compressImage(f);
        const { data } = await entriesApi.uploadPhoto(props.entryId, dataUrl, f.name);
        await sync(data.photos);
        emit('changed', parsePhotos(data.photos));
      } catch {
        // 单张失败不阻塞后续
      }
    }
  } finally {
    uploading.value = false;
  }
}

async function removePhoto(p: PhotoMeta) {
  try {
    const { data } = await entriesApi.deletePhoto(props.entryId, p.id);
    revokePhotoUrl(props.entryId, p.id);
    await sync();
    emit('changed', parsePhotos(data.photos));
  } catch { /* 拦截器已提示 */ }
}

function openPreview(i: number) { previewIndex.value = i; }

onBeforeUnmount(() => {
  for (const p of photos.value) revokePhotoUrl(props.entryId, p.id);
});
</script>

<template>
  <!-- 紧凑模式且无照片：只给一个低调的小按钮，避免长列表杂乱 -->
  <button v-if="compact && editable && photos.length === 0" class="photo-add-mini" :disabled="uploading" @click="pickFiles">
    <el-icon :size="13" :class="{ 'is-loading': uploading }">
      <component :is="uploading ? 'Loading' : 'Plus'" />
    </el-icon>
    {{ uploading ? '上传中…' : '加照片' }}
  </button>

  <div v-else-if="photos.length || (editable && !compact)" class="photo-block">
    <div class="photo-grid">
      <div v-for="(p, i) in photos" :key="p.id" class="photo-tile">
        <img v-if="urls[p.id]" :src="urls[p.id]" :alt="p.name" @click="openPreview(i)" />
        <div v-else class="photo-loading"><el-icon class="is-loading"><Loading /></el-icon></div>
        <button v-if="editable" class="photo-del" @click.stop="removePhoto(p)">
          <el-icon :size="12"><Close /></el-icon>
        </button>
      </div>

      <button v-if="editable && photos.length < 9" class="photo-add" :disabled="uploading" @click="pickFiles">
        <el-icon :size="20" :class="{ 'is-loading': uploading }">
          <component :is="uploading ? 'Loading' : 'Plus'" />
        </el-icon>
        <span>{{ uploading ? '上传中' : '添加照片' }}</span>
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      style="display:none"
      @change="onFiles"
    />

    <el-image-viewer
      v-if="previewIndex >= 0"
      :url-list="previewList"
      :initial-index="previewIndex"
      teleported
      hide-on-click-modal
      @close="previewIndex = -1"
    />
  </div>
</template>

<style scoped>
.photo-block { margin-top: 10px; }
.photo-add-mini {
  display: inline-flex; align-items: center; gap: 3px;
  margin-top: 8px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-placeholder);
  font-size: var(--fs-micro);
  transition: all var(--dur-fast) var(--ease-out);
}
.photo-add-mini:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg); }
.photo-add-mini:disabled { cursor: wait; }
.photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.photo-tile {
  position: relative;
  width: 76px; height: 76px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  background: var(--color-bg-page);
}
.photo-tile img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; display: block; }
.photo-loading { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-text-placeholder); }
.photo-del {
  position: absolute; top: 3px; right: 3px;
  width: 18px; height: 18px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.photo-tile:hover .photo-del { opacity: 1; }
.photo-add {
  width: 76px; height: 76px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  background: var(--color-bg-page);
  color: var(--color-text-placeholder);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 4px;
  font-size: 11px;
  transition: all var(--dur-fast) var(--ease-out);
}
.photo-add:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-bg); }
.photo-add:disabled { cursor: wait; }
</style>
