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
  <div class="site-tile">
    <!-- En-tête avec nom et actions -->
    <div class="tile-header">
      <h3 class="site-name" @click="emit('open')" title="Ouvrir dans le studio">
        {{ site.name }}
      </h3>
      
      <!-- Actions à droite du nom -->
      <div class="tile-actions">
        <button class="action-btn" @click="emit('duplicate')" title="Dupliquer">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
            <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
          </svg>
        </button>

        <button class="action-btn publish" @click="emit('publish')" title="Publier">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
        </button>

        <button class="action-btn danger" @click="emit('delete')" title="Supprimer">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Informations du site -->
    <div class="tile-info">
      <span class="date">Créé le {{ formattedDate }}</span>
      <span v-if="site.is_published" class="published-badge">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        Publié
      </span>
    </div>

    <!-- Lien vers le site publié -->
    <a v-if="publicUrl" :href="publicUrl" target="_blank" class="public-link">
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
      Voir le site publié
    </a>
  </div>
</template>

<style scoped>
.site-tile {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.2s;
}

.site-tile:hover {
  border-color: var(--accent-muted, rgba(99, 102, 241, 0.5));
  box-shadow: var(--shadow-md);
}

.tile-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.site-name {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  padding: 0.25rem 0;
  transition: color 0.15s;
}

.site-name:hover {
  color: var(--accent);
}

.tile-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-btn.publish:hover {
  color: var(--accent);
  background: rgba(99, 102, 241, 0.1);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.tile-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.date {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.published-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 0.25rem;
  color: #16a34a;
}

.published-badge svg {
  width: 12px;
  height: 12px;
}

.public-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 0.375rem;
  color: #16a34a;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s;
}

.public-link svg {
  width: 14px;
  height: 14px;
}

.public-link:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
}
</style>
