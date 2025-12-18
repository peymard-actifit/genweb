<script setup>
import { computed } from 'vue'

const props = defineProps({
  site: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['open', 'delete', 'duplicate', 'publish'])

const publicUrl = computed(() => {
  if (props.site.is_published && props.site.public_slug) {
    return `/p/${props.site.public_slug}`
  }
  return null
})

const formattedDate = computed(() => {
  const date = new Date(props.site.created_at)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
})
</script>

<template>
  <div class="site-tile" @click="emit('open')">
    <div class="tile-header">
      <h3 class="site-name">{{ site.name }}</h3>
      <span v-if="site.is_published" class="published-badge">Publié</span>
    </div>

    <div class="tile-info">
      <span class="date">Créé le {{ formattedDate }}</span>
    </div>

    <div class="tile-actions" @click.stop>
      <button class="action-btn primary" @click="emit('open')" title="Ouvrir dans le studio">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        Éditer
      </button>

      <button class="action-btn" @click="emit('duplicate')" title="Dupliquer">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
          <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
        </svg>
      </button>

      <button class="action-btn" @click="emit('publish')" title="Publier">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
        </svg>
      </button>

      <a v-if="publicUrl" :href="publicUrl" target="_blank" class="action-btn public-link" title="Voir le site publié">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
      </a>

      <button class="action-btn danger" @click="emit('delete')" title="Supprimer">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.site-tile {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: all 0.2s;
  cursor: pointer;
}

.site-tile:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.tile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.site-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.published-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 0.25rem;
  color: #16a34a;
  text-transform: uppercase;
  flex-shrink: 0;
}

.tile-info {
  margin-bottom: 1rem;
}

.date {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.tile-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  padding: 0.5rem 0.75rem;
}

.action-btn.primary:hover {
  background: var(--accent-hover);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #dc2626;
}

.action-btn.public-link {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #16a34a;
}

.action-btn.public-link:hover {
  background: rgba(34, 197, 94, 0.2);
}
</style>
