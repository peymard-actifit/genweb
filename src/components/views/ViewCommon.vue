<script setup>
defineProps({
  site: {
    type: Object,
    default: null
  },
  view: {
    type: Object,
    default: null
  }
})
</script>

<template>
  <div class="view-common">
    <div class="view-content">
      <div class="welcome-section">
        <div class="icon">⚙️</div>
        <h2>Vue Commun</h2>
        <p>Paramètres généraux du site <strong>{{ site?.name }}</strong></p>
      </div>

      <div class="info-cards">
        <div class="info-card">
          <div class="card-icon">🏠</div>
          <div class="card-content">
            <h3>Site</h3>
            <p>Modifiez le nom et les informations générales du site</p>
          </div>
        </div>

        <div class="info-card">
          <div class="card-icon">🔐</div>
          <div class="card-content">
            <h3>Login</h3>
            <p>Configurez l'authentification des utilisateurs</p>
          </div>
        </div>

        <div class="info-card">
          <div class="card-icon">🎨</div>
          <div class="card-content">
            <h3>Apparence</h3>
            <p>Personnalisez les couleurs et le thème</p>
          </div>
        </div>

        <div class="info-card">
          <div class="card-icon">📑</div>
          <div class="card-content">
            <h3>Navigation</h3>
            <p>Choisissez entre onglets ou menu latéral</p>
          </div>
        </div>
      </div>

      <div class="help-text">
        <p>👈 Utilisez le panneau d'édition à droite pour modifier ces paramètres</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-common {
  padding: 2rem;
  min-height: 100%;
}

.view-content {
  max-width: 800px;
  margin: 0 auto;
}

.welcome-section {
  text-align: center;
  margin-bottom: 3rem;
}

.icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.welcome-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.welcome-section p {
  color: var(--text-muted);
}

.welcome-section strong {
  color: var(--accent);
}

.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.info-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  transition: all 0.2s;
}

.info-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.card-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.card-content h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.card-content p {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
}

.help-text {
  text-align: center;
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 0.75rem;
}

.help-text p {
  margin: 0;
  color: var(--accent);
  font-size: 0.9375rem;
}
</style>

