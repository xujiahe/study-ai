<template>
  <Teleport to="body">
    <div class="overlay" @click.self="$emit('cancel')" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="dialog">
        <h3 id="confirm-title" class="dialog-title">删除对话</h3>
        <p class="dialog-message">
          确定要删除「<strong>{{ title }}</strong>」吗？此操作不可撤销。
        </p>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="$emit('cancel')">取消</button>
          <button class="btn-confirm" @click="$emit('confirm')">删除</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 320px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px;
}

.dialog-message {
  font-size: 14px;
  color: #555;
  margin: 0 0 20px;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  font-weight: 500;
  transition: background 0.15s;
}

.btn-cancel {
  background: #f0f0f0;
  color: #555;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-confirm {
  background: #ef4444;
  color: white;
}

.btn-confirm:hover {
  background: #dc2626;
}
</style>
