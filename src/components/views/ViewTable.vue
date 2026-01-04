<script setup>
/**
 * Vue Table - Jeu de Bridge
 * Affiche un tapis de bridge en perspective 3D (vue depuis SUD)
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  view: { type: Object, required: true },
  site: { type: Object, required: true },
  isEditing: { type: Boolean, default: false }
})

const authStore = useAuthStore()

// État des tables
const tables = ref([])
const currentTable = ref(null)
const showCreateModal = ref(false)
const newTableName = ref('')
const loading = ref(false)

// État du joueur
const myPosition = ref(null) // 'S', 'W', 'N', 'E'
const myCards = ref([])

// État du jeu
const currentPhase = ref('waiting') // 'waiting', 'bidding', 'playing'
const bids = ref([])
const currentTrick = ref([])
const declarer = ref(null)
const contract = ref(null)

// Chat
const chatMessages = ref([])
const newMessage = ref('')

// Contrôles vidéo/audio pour chaque joueur
const videoControls = ref({
  N: { video: true, audio: true },
  E: { video: true, audio: true },
  S: { video: true, audio: true },
  W: { video: true, audio: true }
})

function toggleVideo(position) {
  videoControls.value[position].video = !videoControls.value[position].video
}

function toggleAudio(position) {
  videoControls.value[position].audio = !videoControls.value[position].audio
}

// Positions des joueurs (relatif à SUD qui est toujours en bas)
const positions = computed(() => ({
  S: { name: 'Sud (Vous)', class: 'position-south', isMe: myPosition.value === 'S' },
  W: { name: 'Ouest', class: 'position-west', isMe: myPosition.value === 'W' },
  N: { name: 'Nord', class: 'position-north', isMe: myPosition.value === 'N' },
  E: { name: 'Est', class: 'position-east', isMe: myPosition.value === 'E' }
}))

// Cartes d'un jeu de 52 cartes
const suits = ['♠', '♥', '♦', '♣']
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

// Enchères disponibles
const bidLevels = [1, 2, 3, 4, 5, 6, 7]
const bidSuits = ['♣', '♦', '♥', '♠', 'SA']
const specialBids = ['Passe', 'Contre', 'Surcontre']

// Fonctions de gestion des tables
async function fetchTables() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('bridge_tables')
      .select('*, bridge_players(*)')
      .eq('site_id', props.site.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    tables.value = data || []
    
    // Vérifier si l'utilisateur est déjà assis à une table
    for (const table of tables.value) {
      const myPlayer = table.bridge_players?.find(p => p.user_id === authStore.user?.id)
      if (myPlayer) {
        console.log('Déjà assis à la table:', table.name, 'position:', myPlayer.position)
        // Ne pas entrer automatiquement, montrer un bouton "Reprendre"
      }
    }
  } catch (err) {
    console.error('Erreur chargement tables:', err)
  } finally {
    loading.value = false
  }
}

// Vérifier si l'utilisateur est déjà à une table
function getMyTablePosition(table) {
  const player = table.bridge_players?.find(p => p.user_id === authStore.user?.id)
  return player?.position || null
}

async function createTable() {
  if (!newTableName.value.trim()) return
  
  try {
    const { data: tableData, error } = await supabase
      .from('bridge_tables')
      .insert({
        site_id: props.site.id,
        name: newTableName.value.trim(),
        created_by: authStore.user?.id,
        status: 'waiting'
      })
      .select('*, bridge_players(*)')
      .single()
    
    if (error) throw error
    
    // Ajouter le joueur à la table
    const { error: playerError } = await supabase
      .from('bridge_players')
      .insert({
        table_id: tableData.id,
        user_id: authStore.user?.id,
        position: 'S',
        is_ready: false
      })
    
    if (playerError) throw playerError
    
    // Mettre à jour l'état local directement
    currentTable.value = tableData
    myPosition.value = 'S'
    
    // S'abonner aux updates en temps réel
    subscribeToTable(tableData.id)
    
    showCreateModal.value = false
    newTableName.value = ''
    
    console.log('Table créée et rejoint:', tableData.name)
  } catch (err) {
    console.error('Erreur création table:', err)
    alert('Erreur lors de la création: ' + err.message)
  }
}

async function joinTable(tableId, position) {
  try {
    // Vérifier si la position est libre
    const { data: existing } = await supabase
      .from('bridge_players')
      .select('*')
      .eq('table_id', tableId)
      .eq('position', position)
      .maybeSingle()
    
    if (existing) {
      // Si c'est nous qui sommes déjà là, on rejoint directement
      if (existing.user_id === authStore.user?.id) {
        await enterTable(tableId, position)
        return
      }
      alert('Cette position est déjà prise !')
      return
    }
    
    const { error } = await supabase
      .from('bridge_players')
      .insert({
        table_id: tableId,
        user_id: authStore.user?.id,
        position: position,
        is_ready: false
      })
    
    if (error) throw error
    
    await enterTable(tableId, position)
  } catch (err) {
    console.error('Erreur rejoindre table:', err)
    alert('Erreur: ' + err.message)
  }
}

// Entrer sur une table (afficher la vue table)
async function enterTable(tableId, position) {
  const { data: tableData, error } = await supabase
    .from('bridge_tables')
    .select('*, bridge_players(*)')
    .eq('id', tableId)
    .single()
  
  if (error) {
    console.error('Erreur chargement table:', error)
    return
  }
  
  currentTable.value = tableData
  myPosition.value = position
  
  // S'abonner aux updates en temps réel
  subscribeToTable(tableId)
  
  console.log('Entré sur la table:', tableData.name, 'position:', position)
}

async function leaveTable() {
  if (!currentTable.value) return
  
  try {
    await supabase
      .from('bridge_players')
      .delete()
      .eq('table_id', currentTable.value.id)
      .eq('user_id', authStore.user?.id)
    
    currentTable.value = null
    myPosition.value = null
    myCards.value = []
  } catch (err) {
    console.error('Erreur quitter table:', err)
  }
}

function subscribeToTable(tableId) {
  // Abonnement temps réel Supabase
  supabase
    .channel(`table-${tableId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bridge_players',
      filter: `table_id=eq.${tableId}`
    }, (payload) => {
      console.log('Changement joueurs:', payload)
      fetchTables()
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bridge_games',
      filter: `table_id=eq.${tableId}`
    }, (payload) => {
      console.log('Changement jeu:', payload)
      // Mettre à jour l'état du jeu
    })
    .subscribe()
}

// Fonctions de jeu
function playCard(card) {
  if (currentPhase.value !== 'playing') return
  console.log('Jouer carte:', card)
  // TODO: Implémenter la logique de jeu
}

function makeBid(bid) {
  if (currentPhase.value !== 'bidding') return
  console.log('Enchère:', bid)
  // TODO: Implémenter la logique d'enchères
}

function sendMessage() {
  if (!newMessage.value.trim()) return
  chatMessages.value.push({
    user: authStore.userName,
    text: newMessage.value,
    time: new Date()
  })
  newMessage.value = ''
}

// Cartes de démonstration
function generateDemoHand() {
  const hand = []
  const usedCards = new Set()
  
  while (hand.length < 13) {
    const suit = suits[Math.floor(Math.random() * 4)]
    const rank = ranks[Math.floor(Math.random() * 13)]
    const card = `${rank}${suit}`
    
    if (!usedCards.has(card)) {
      usedCards.add(card)
      hand.push({ rank, suit, id: card })
    }
  }
  
  // Trier par couleur puis par rang
  return hand.sort((a, b) => {
    const suitOrder = suits.indexOf(a.suit) - suits.indexOf(b.suit)
    if (suitOrder !== 0) return suitOrder
    return ranks.indexOf(a.rank) - ranks.indexOf(b.rank)
  })
}

onMounted(() => {
  fetchTables()
  // Générer une main de démo
  myCards.value = generateDemoHand()
})
</script>

<template>
  <div class="view-table">
    <!-- Si pas à une table, afficher la liste des tables -->
    <div v-if="!currentTable" class="tables-lobby">
      <div class="lobby-header">
        <h2>🎴 Tables de Bridge</h2>
        <button class="btn-create" @click="showCreateModal = true">
          + Créer une table
        </button>
      </div>
      
      <div v-if="loading" class="loading">Chargement...</div>
      
      <div v-else-if="tables.length === 0" class="no-tables">
        <p>Aucune table disponible</p>
        <p class="hint">Créez une table pour commencer une partie !</p>
      </div>
      
      <div v-else class="tables-grid">
        <div v-for="table in tables" :key="table.id" class="table-card" :class="{ 'my-table': getMyTablePosition(table) }">
          <div class="table-name">{{ table.name }}</div>
          <div class="table-status">{{ table.status === 'waiting' ? 'En attente' : 'En cours' }}</div>
          <div class="table-seats">
            <div 
              v-for="pos in ['N', 'E', 'S', 'W']" 
              :key="pos"
              class="seat"
              :class="{ 
                occupied: table.bridge_players?.find(p => p.position === pos),
                'is-me': table.bridge_players?.find(p => p.position === pos && p.user_id === authStore.user?.id)
              }"
              @click="joinTable(table.id, pos)"
            >
              {{ pos }}
            </div>
          </div>
          <div class="table-players">
            {{ table.bridge_players?.length || 0 }}/4 joueurs
          </div>
          <!-- Bouton Reprendre si on est déjà à cette table -->
          <button 
            v-if="getMyTablePosition(table)" 
            class="btn-resume"
            @click="enterTable(table.id, getMyTablePosition(table))"
          >
            🎴 Reprendre ({{ getMyTablePosition(table) }})
          </button>
        </div>
      </div>
    </div>
    
    <!-- Vue du tapis de bridge plein écran -->
    <div v-else class="bridge-fullscreen">
      <!-- Header compact -->
      <div class="table-header">
        <button class="btn-leave" @click="leaveTable">← Quitter</button>
        <h3>{{ currentTable.name }}</h3>
        <span class="phase-badge">{{ currentPhase === 'waiting' ? 'En attente' : currentPhase === 'bidding' ? 'Enchères' : 'Jeu' }}</span>
      </div>
      
      <!-- Zone vidéo NORD (haut de l'écran) -->
      <div class="video-zone video-north">
        <span class="video-label">N</span>
        <div class="video-content">
          <div class="video-placeholder"></div>
        </div>
        <div class="video-controls">
          <button @click="toggleVideo('N')" :class="{ off: !videoControls.N.video }">
            {{ videoControls.N.video ? '📹' : '📷' }}
          </button>
          <button @click="toggleAudio('N')" :class="{ off: !videoControls.N.audio }">
            {{ videoControls.N.audio ? '🔊' : '🔇' }}
          </button>
        </div>
        <!-- Cartes du Nord (dos) -->
        <div class="opponent-cards horizontal">
          <div v-for="i in 13" :key="i" class="card-back-small"></div>
        </div>
      </div>
      
      <!-- Zone vidéo OUEST (gauche de l'écran) -->
      <div class="video-zone video-west">
        <span class="video-label">O</span>
        <div class="video-content">
          <div class="video-placeholder"></div>
        </div>
        <div class="video-controls">
          <button @click="toggleVideo('W')" :class="{ off: !videoControls.W.video }">
            {{ videoControls.W.video ? '📹' : '📷' }}
          </button>
          <button @click="toggleAudio('W')" :class="{ off: !videoControls.W.audio }">
            {{ videoControls.W.audio ? '🔊' : '🔇' }}
          </button>
        </div>
        <!-- Cartes de l'Ouest (dos vertical) -->
        <div class="opponent-cards vertical">
          <div v-for="i in 13" :key="i" class="card-back-small"></div>
        </div>
      </div>
      
      <!-- Zone vidéo EST (droite de l'écran) -->
      <div class="video-zone video-east">
        <span class="video-label">E</span>
        <div class="video-content">
          <div class="video-placeholder"></div>
        </div>
        <div class="video-controls">
          <button @click="toggleVideo('E')" :class="{ off: !videoControls.E.video }">
            {{ videoControls.E.video ? '📹' : '📷' }}
          </button>
          <button @click="toggleAudio('E')" :class="{ off: !videoControls.E.audio }">
            {{ videoControls.E.audio ? '🔊' : '🔇' }}
          </button>
        </div>
        <!-- Cartes de l'Est (dos vertical) -->
        <div class="opponent-cards vertical">
          <div v-for="i in 13" :key="i" class="card-back-small"></div>
        </div>
      </div>
      
      <!-- Tapis de bridge central -->
      <div class="table-center">
        <div class="table-felt">
          <!-- Zone des cartes jouées -->
          <div class="trick-area">
            <div class="played-card north-play"></div>
            <div class="played-card west-play"></div>
            <div class="played-card east-play"></div>
            <div class="played-card south-play"></div>
          </div>
          <!-- Direction indicator -->
          <div class="compass">
            <span class="compass-n">N</span>
            <span class="compass-w">O</span>
            <span class="compass-e">E</span>
            <span class="compass-s">S</span>
          </div>
        </div>
      </div>
      
      <!-- Zone basse: Chat à gauche, Cartes au centre, Ma vidéo à droite -->
      <div class="bottom-zone">
        <!-- Chat panel (gauche) -->
        <div class="chat-panel">
          <div class="chat-header">💬 Chat de table</div>
          <div class="chat-messages">
            <div v-for="(msg, i) in chatMessages" :key="i" class="chat-message">
              <strong>{{ msg.user }}:</strong> {{ msg.text }}
            </div>
            <div v-if="chatMessages.length === 0" class="chat-empty">
              Aucun message
            </div>
          </div>
          <div class="chat-input">
            <input 
              v-model="newMessage" 
              placeholder="Message..." 
              @keyup.enter="sendMessage"
            />
            <button @click="sendMessage">↵</button>
          </div>
        </div>
        
        <!-- Cartes du joueur (centre) -->
        <div class="my-hand-zone">
          <div class="my-hand">
            <div 
              v-for="(card, index) in myCards" 
              :key="card.id"
              class="card"
              :class="{ 'suit-red': card.suit === '♥' || card.suit === '♦' }"
              :style="{ '--card-index': index }"
              @click="playCard(card)"
            >
              <span class="card-rank">{{ card.rank }}</span>
              <span class="card-suit">{{ card.suit }}</span>
            </div>
          </div>
        </div>
        
        <!-- Ma vidéo (droite) -->
        <div class="my-video-zone">
          <span class="video-label">S (Moi)</span>
          <div class="video-content">
            <div class="video-placeholder"></div>
          </div>
          <div class="video-controls">
            <button @click="toggleVideo('S')" :class="{ off: !videoControls.S.video }">
              {{ videoControls.S.video ? '📹' : '📷' }}
            </button>
            <button @click="toggleAudio('S')" :class="{ off: !videoControls.S.audio }">
              {{ videoControls.S.audio ? '🔊' : '🔇' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Boîte à enchères (visible pendant les enchères) -->
      <div v-if="currentPhase === 'bidding'" class="bidding-box">
        <div class="bid-grid">
          <div v-for="level in bidLevels" :key="level" class="bid-row">
            <button 
              v-for="suit in bidSuits" 
              :key="`${level}${suit}`"
              class="bid-btn"
              :class="{ 'suit-clubs': suit === '♣', 'suit-diamonds': suit === '♦', 'suit-hearts': suit === '♥', 'suit-spades': suit === '♠', 'suit-nt': suit === 'SA' }"
              @click="makeBid(`${level}${suit}`)"
            >
              {{ level }}{{ suit }}
            </button>
          </div>
        </div>
        <div class="special-bids">
          <button v-for="bid in specialBids" :key="bid" class="bid-btn special" @click="makeBid(bid)">
            {{ bid }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Modal création de table -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-content">
          <h3>Créer une table</h3>
          <input 
            v-model="newTableName" 
            placeholder="Nom de la table"
            @keyup.enter="createTable"
          />
          <div class="modal-actions">
            <button class="btn-cancel" @click="showCreateModal = false">Annuler</button>
            <button class="btn-confirm" @click="createTable">Créer</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.view-table {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
}

/* Lobby des tables */
.tables-lobby {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.lobby-header h2 {
  font-size: 1.5rem;
  margin: 0;
}

.btn-create {
  padding: 0.75rem 1.5rem;
  background: #4ade80;
  border: none;
  border-radius: 0.5rem;
  color: #1a1a2e;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-create:hover {
  background: #22c55e;
  transform: translateY(-2px);
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.table-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  padding: 1.5rem;
  transition: all 0.2s;
}

.table-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-4px);
}

.table-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.table-status {
  font-size: 0.875rem;
  color: #4ade80;
  margin-bottom: 1rem;
}

.table-seats {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.seat {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.seat:hover:not(.occupied) {
  background: rgba(74, 222, 128, 0.3);
  border-color: #4ade80;
}

.seat.occupied {
  background: #4ade80;
  border-style: solid;
  border-color: #4ade80;
  color: #1a1a2e;
  cursor: default;
}

.table-players {
  text-align: center;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}

.table-card.my-table {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.seat.is-me {
  background: #f59e0b !important;
  border-color: #f59e0b !important;
  color: #1a1a2e !important;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
}

.btn-resume {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #4ade80, #22c55e);
  border: none;
  border-radius: 0.5rem;
  color: #1a1a2e;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-resume:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
}

/* ================================
   VUE TABLE PLEIN ÉCRAN
   ================================ */
.bridge-fullscreen {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-areas:
    "header header header"
    "west north east"
    "west center east"
    "bottom bottom bottom";
  grid-template-rows: auto 1fr 2fr 200px;
  grid-template-columns: 180px 1fr 180px;
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  overflow: hidden;
}

/* Header */
.table-header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.table-header h3 {
  margin: 0;
  font-size: 1rem;
}

.btn-leave {
  padding: 0.4rem 0.8rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-leave:hover {
  background: rgba(255, 255, 255, 0.2);
}

.phase-badge {
  margin-left: auto;
  padding: 0.25rem 0.75rem;
  background: #4ade80;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1a1a2e;
}

/* ================================
   ZONES VIDÉO
   ================================ */
.video-zone {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  position: relative;
}

.video-north {
  grid-area: north;
  align-items: center;
  justify-content: flex-start;
}

.video-west {
  grid-area: west;
  align-items: flex-start;
  justify-content: center;
}

.video-east {
  grid-area: east;
  align-items: flex-end;
  justify-content: center;
}

.video-label {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  font-size: 1.25rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(0, 0, 0, 0.5);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  z-index: 10;
}

.video-content {
  width: 160px;
  height: 120px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: #1a1a2e;
}

.video-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2d3748, #1a202c);
}

.video-controls {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.video-controls button {
  padding: 0.3rem 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.video-controls button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.video-controls button.off {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
}

/* Cartes des adversaires */
.opponent-cards {
  display: flex;
  margin-top: 0.5rem;
}

.opponent-cards.horizontal {
  flex-direction: row;
}

.opponent-cards.vertical {
  flex-direction: column;
}

.card-back-small {
  width: 25px;
  height: 35px;
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  border: 1px solid #60a5fa;
  border-radius: 2px;
  margin-left: -18px;
}

.opponent-cards.vertical .card-back-small {
  margin-left: 0;
  margin-top: -28px;
}

.card-back-small:first-child {
  margin-left: 0;
  margin-top: 0;
}

/* ================================
   TAPIS CENTRAL
   ================================ */
.table-center {
  grid-area: center;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.table-felt {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 1;
  background: #2d5a27;
  border-radius: 1rem;
  box-shadow: 
    0 10px 40px rgba(0, 0, 0, 0.5),
    inset 0 0 60px rgba(0, 0, 0, 0.3);
  border: 10px solid #5c3d2e;
  position: relative;
}

.trick-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  display: grid;
  grid-template-areas:
    ". n ."
    "w . e"
    ". s .";
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: 1fr auto 1fr;
  gap: 0.5rem;
}

.played-card {
  width: 45px;
  height: 63px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  opacity: 0.3;
}

.north-play { grid-area: n; justify-self: center; }
.east-play { grid-area: e; align-self: center; }
.south-play { grid-area: s; justify-self: center; }
.west-play { grid-area: w; align-self: center; }

.compass {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.7);
}

.compass-n { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); }
.compass-s { position: absolute; bottom: -15px; left: 50%; transform: translateX(-50%); }
.compass-e { position: absolute; right: -15px; top: 50%; transform: translateY(-50%); }
.compass-w { position: absolute; left: -15px; top: 50%; transform: translateY(-50%); }

/* ================================
   ZONE BASSE
   ================================ */
.bottom-zone {
  grid-area: bottom;
  display: grid;
  grid-template-columns: 280px 1fr 200px;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Chat Panel */
.chat-panel {
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  overflow: hidden;
}

.chat-header {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.85rem;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  font-size: 0.8rem;
}

.chat-message {
  margin-bottom: 0.35rem;
  line-height: 1.3;
}

.chat-empty {
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

.chat-input {
  display: flex;
  gap: 0.25rem;
  padding: 0.35rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-input input {
  flex: 1;
  padding: 0.4rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  color: white;
  font-size: 0.8rem;
}

.chat-input button {
  padding: 0.4rem 0.6rem;
  background: #4ade80;
  border: none;
  border-radius: 0.25rem;
  color: #1a1a2e;
  font-weight: 600;
  cursor: pointer;
}

/* Zone des cartes du joueur */
.my-hand-zone {
  display: flex;
  align-items: center;
  justify-content: center;
}

.my-hand {
  display: flex;
  justify-content: center;
}

.card {
  width: 60px;
  height: 85px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: -25px;
  position: relative;
}

.card:first-child {
  margin-left: 0;
}

.card:hover {
  transform: translateY(-15px);
  z-index: 100 !important;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
}

.card-rank {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1a1a2e;
}

.card-suit {
  font-size: 1.5rem;
}

.card.suit-red .card-rank,
.card.suit-red .card-suit {
  color: #dc2626;
}

/* Ma vidéo */
.my-video-zone {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  position: relative;
}

.my-video-zone .video-label {
  position: static;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.my-video-zone .video-content {
  width: 160px;
  height: 100px;
}

/* ================================
   BOÎTE À ENCHÈRES
   ================================ */
.bidding-box {
  position: fixed;
  top: 50%;
  right: 200px;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  padding: 0.75rem;
  z-index: 100;
}

.bid-grid {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.bid-row {
  display: flex;
  gap: 0.2rem;
}

.bid-btn {
  width: 34px;
  height: 26px;
  border: none;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transition: all 0.1s;
}

.bid-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.bid-btn.suit-clubs { color: #22c55e; }
.bid-btn.suit-diamonds { color: #f97316; }
.bid-btn.suit-hearts { color: #ef4444; }
.bid-btn.suit-spades { color: #3b82f6; }
.bid-btn.suit-nt { color: #a855f7; }

.special-bids {
  display: flex;
  gap: 0.2rem;
  margin-top: 0.4rem;
}

.bid-btn.special {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
}

.modal-content h3 {
  margin: 0 0 1rem;
}

.modal-content input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
}

.btn-confirm {
  padding: 0.75rem 1.5rem;
  background: #4ade80;
  border: none;
  border-radius: 0.5rem;
  color: #1a1a2e;
  font-weight: 600;
  cursor: pointer;
}

/* États */
.loading, .no-tables {
  text-align: center;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.6);
}

.no-tables .hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
</style>
