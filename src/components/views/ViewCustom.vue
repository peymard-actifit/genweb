<script setup>
import { computed } from 'vue'

const props = defineProps({
  site: {
    type: Object,
    default: null
  },
  view: {
    type: Object,
    default: null
  }
})

const viewIcon = computed(() => {
  switch (props.view?.type) {
    case 'media': return '🖼️'
    case 'gestion': return '📊'
    default: return '✨'
  }
})

const viewDescription = computed(() => {
  switch (props.view?.type) {
    case 'media': return 'Gérez vos médias : photos, vidéos, fichiers audio et documents'
    case 'gestion': return 'Organisez et suivez vos données et activités'
    default: return 'Vue personnalisable selon vos besoins'
  }
})
</script>

<template>
  <div class="view-custom">
    <div class="view-header">
      <span class="view-icon">{{ viewIcon }}</span>
      <div class="view-info">
        <h2>{{ view?.name || 'Vue' }}</h2>
        <p>{{ viewDescription }}</p>
      </div>
    </div>

    <div class="view-workspace">
      <div class="empty-workspace">
        <div class="drop-zone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <p>Glissez des éléments ici</p>
          <span>ou utilisez le panneau d'édition pour ajouter du contenu</span>
        </div>
      </div>
    </div>

    <!-- Aperçu des outils selon le type de vue -->
    <div class="tools-preview" v-if="view?.type === 'media'">
      <h3>Outils disponibles</h3>
      <div class="tools-grid">
        <div class="tool-card">
          <span>📷</span>
          <span>Photos</span>
        </div>
        <div class="tool-card">
          <span>🎬</span>
          <span>Vidéos</span>
        </div>
        <div class="tool-card">
          <span>🎵</span>
          <span>Audio</span>
        </div>
        <div class="tool-card">
          <span>📁</span>
          <span>Fichiers</span>
        </div>
      </div>
    </div>

    <div class="tools-preview" v-else-if="view?.type === 'gestion'">
      <h3>Outils disponibles</h3>
      <div class="tools-grid">
        <div class="tool-card">
          <span>📋</span>
          <span>Listes</span>
        </div>
        <div class="tool-card">
          <span>📊</span>
          <span>Tableaux</span>
        </div>
        <div class="tool-card">
          <span>📈</span>
          <span>Graphiques</span>
        </div>
        <div class="tool-card">
          <span>📅</span>
          <span>Calendrier</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-custom {
  padding: 2rem;
  min-height: 100%;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.view-icon {
  font-size: 3rem;
}

.view-info h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.view-info p {
  color: var(--text-muted);
  margin: 0;
}

.view-workspace {
  margin-bottom: 2rem;
}

.empty-workspace {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 400px;
  padding: 3rem;
  border: 2px dashed var(--border-color);
  border-radius: 1rem;
  text-align: center;
  transition: all 0.2s;
}

.drop-zone:hover {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.05);
}

.drop-zone svg {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.drop-zone p {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.drop-zone span {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.tools-preview {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.tools-preview h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.tool-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.tool-card span:first-child {
  font-size: 1.5rem;
}

.tool-card span:last-child {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>

