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
  } catch (err) {
    console.error('Erreur chargement tables:', err)
  } finally {
    loading.value = false
  }
}

async function createTable() {
  if (!newTableName.value.trim()) return
  
  try {
    const { data, error } = await supabase
      .from('bridge_tables')
      .insert({
        site_id: props.site.id,
        name: newTableName.value.trim(),
        created_by: authStore.user?.id,
        status: 'waiting'
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Rejoindre automatiquement en position Sud
    await joinTable(data.id, 'S')
    showCreateModal.value = false
    newTableName.value = ''
  } catch (err) {
    console.error('Erreur création table:', err)
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
      .single()
    
    if (existing) {
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
    
    currentTable.value = tables.value.find(t => t.id === tableId)
    myPosition.value = position
    
    // S'abonner aux updates en temps réel
    subscribeToTable(tableId)
  } catch (err) {
    console.error('Erreur rejoindre table:', err)
  }
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
        <div v-for="table in tables" :key="table.id" class="table-card">
          <div class="table-name">{{ table.name }}</div>
          <div class="table-status">{{ table.status === 'waiting' ? 'En attente' : 'En cours' }}</div>
          <div class="table-seats">
            <div 
              v-for="pos in ['N', 'E', 'S', 'W']" 
              :key="pos"
              class="seat"
              :class="{ occupied: table.bridge_players?.find(p => p.position === pos) }"
              @click="!table.bridge_players?.find(p => p.position === pos) && joinTable(table.id, pos)"
            >
              {{ pos }}
            </div>
          </div>
          <div class="table-players">
            {{ table.bridge_players?.length || 0 }}/4 joueurs
          </div>
        </div>
      </div>
    </div>
    
    <!-- Vue du tapis de bridge en perspective -->
    <div v-else class="bridge-table-container">
      <!-- Header avec infos de la table -->
      <div class="table-header">
        <button class="btn-leave" @click="leaveTable">← Quitter la table</button>
        <h3>{{ currentTable.name }}</h3>
        <span class="phase-badge">{{ currentPhase === 'waiting' ? 'En attente' : currentPhase === 'bidding' ? 'Enchères' : 'Jeu' }}</span>
      </div>
      
      <!-- Tapis de bridge en 3D -->
      <div class="bridge-scene">
        <div class="bridge-table">
          <!-- Tapis vert -->
          <div class="table-felt">
            <!-- Zone centrale pour les cartes jouées -->
            <div class="trick-area">
              <div class="played-card north-play"></div>
              <div class="played-card east-play"></div>
              <div class="played-card south-play"></div>
              <div class="played-card west-play"></div>
            </div>
            
            <!-- Indicateur de direction -->
            <div class="direction-indicator">
              <span class="dir-n">N</span>
              <span class="dir-e">E</span>
              <span class="dir-s">S</span>
              <span class="dir-w">O</span>
            </div>
          </div>
          
          <!-- Joueur Nord (en face) -->
          <div class="player-position north">
            <div class="player-video">
              <div class="video-placeholder">
                <span class="player-initial">N</span>
              </div>
            </div>
            <div class="player-name">Nord</div>
            <div class="player-cards-back">
              <div v-for="i in 13" :key="i" class="card-back"></div>
            </div>
          </div>
          
          <!-- Joueur Est (à droite) -->
          <div class="player-position east">
            <div class="player-video">
              <div class="video-placeholder">
                <span class="player-initial">E</span>
              </div>
            </div>
            <div class="player-name">Est</div>
            <div class="player-cards-back vertical">
              <div v-for="i in 13" :key="i" class="card-back"></div>
            </div>
          </div>
          
          <!-- Joueur Ouest (à gauche) -->
          <div class="player-position west">
            <div class="player-video">
              <div class="video-placeholder">
                <span class="player-initial">O</span>
              </div>
            </div>
            <div class="player-name">Ouest</div>
            <div class="player-cards-back vertical">
              <div v-for="i in 13" :key="i" class="card-back"></div>
            </div>
          </div>
        </div>
        
        <!-- Boîte à enchères (seulement visible pendant les enchères) -->
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
        
        <!-- Cartes du joueur (Sud) -->
        <div class="my-hand">
          <div 
            v-for="(card, index) in myCards" 
            :key="card.id"
            class="card"
            :class="{ 'suit-red': card.suit === '♥' || card.suit === '♦' }"
            :style="{ '--card-index': index, '--total-cards': myCards.length }"
            @click="playCard(card)"
          >
            <span class="card-rank">{{ card.rank }}</span>
            <span class="card-suit">{{ card.suit }}</span>
          </div>
        </div>
      </div>
      
      <!-- Chat -->
      <div class="chat-panel">
        <div class="chat-header">
          <span>💬 Chat</span>
        </div>
        <div class="chat-messages">
          <div v-for="(msg, i) in chatMessages" :key="i" class="chat-message">
            <strong>{{ msg.user }}:</strong> {{ msg.text }}
          </div>
        </div>
        <div class="chat-input">
          <input 
            v-model="newMessage" 
            placeholder="Votre message..." 
            @keyup.enter="sendMessage"
          />
          <button @click="sendMessage">Envoyer</button>
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

/* Container de la table */
.bridge-table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
}

.btn-leave {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
}

.phase-badge {
  padding: 0.25rem 0.75rem;
  background: #4ade80;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1a1a2e;
}

/* Scène 3D du bridge */
.bridge-scene {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
  padding: 1rem;
  position: relative;
}

.bridge-table {
  width: 100%;
  max-width: 700px;
  aspect-ratio: 1;
  position: relative;
  transform: rotateX(45deg);
  transform-style: preserve-3d;
}

.table-felt {
  position: absolute;
  inset: 15%;
  background: #2d5a27;
  border-radius: 1rem;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.5),
    inset 0 0 50px rgba(0, 0, 0, 0.3);
  border: 8px solid #5c3d2e;
}

.trick-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  display: grid;
  grid-template-areas:
    ". n ."
    "w . e"
    ". s .";
  gap: 0.25rem;
}

.played-card {
  width: 40px;
  height: 56px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.north-play { grid-area: n; justify-self: center; }
.east-play { grid-area: e; align-self: center; }
.south-play { grid-area: s; justify-self: center; }
.west-play { grid-area: w; align-self: center; }

.direction-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  font-size: 0.75rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.5);
}

.dir-n { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); }
.dir-s { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); }
.dir-e { position: absolute; right: -20px; top: 50%; transform: translateY(-50%); }
.dir-w { position: absolute; left: -20px; top: 50%; transform: translateY(-50%); }

/* Positions des joueurs */
.player-position {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.player-position.north {
  top: 0;
  left: 50%;
  transform: translateX(-50%) rotateX(-45deg);
}

.player-position.south {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%) rotateX(-45deg);
}

.player-position.east {
  right: 0;
  top: 50%;
  transform: translateY(-50%) rotateX(-45deg);
}

.player-position.west {
  left: 0;
  top: 50%;
  transform: translateY(-50%) rotateX(-45deg);
}

.player-video {
  width: 80px;
  height: 60px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4a5568, #2d3748);
}

.player-initial {
  font-size: 1.5rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.5);
}

.player-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.player-cards-back {
  display: flex;
  gap: -20px;
}

.player-cards-back.vertical {
  flex-direction: column;
  gap: -30px;
}

.card-back {
  width: 30px;
  height: 42px;
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  border: 1px solid #60a5fa;
  border-radius: 3px;
  margin-left: -15px;
}

.card-back:first-child {
  margin-left: 0;
}

/* Main du joueur (Sud) */
.my-hand {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
}

.card {
  width: 70px;
  height: 100px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: calc(var(--card-index) * -30px + 30px);
  position: relative;
  z-index: var(--card-index);
}

.card:hover {
  transform: translateY(-20px);
  z-index: 100;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
}

.card-rank {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1a1a2e;
}

.card-suit {
  font-size: 2rem;
}

.card.suit-red .card-rank,
.card.suit-red .card-suit {
  color: #dc2626;
}

/* Boîte à enchères */
.bidding-box {
  position: fixed;
  bottom: 140px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  padding: 1rem;
  z-index: 100;
}

.bid-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.bid-row {
  display: flex;
  gap: 0.25rem;
}

.bid-btn {
  width: 36px;
  height: 28px;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transition: all 0.15s;
}

.bid-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.bid-btn.suit-clubs { color: #22c55e; }
.bid-btn.suit-diamonds { color: #f97316; }
.bid-btn.suit-hearts { color: #ef4444; }
.bid-btn.suit-spades { color: #3b82f6; }
.bid-btn.suit-nt { color: #a855f7; }

.special-bids {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.bid-btn.special {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
}

/* Chat */
.chat-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 300px;
  max-height: 300px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.chat-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-weight: 600;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1rem;
  max-height: 150px;
}

.chat-message {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-input input {
  flex: 1;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
}

.chat-input button {
  padding: 0.5rem 1rem;
  background: #4ade80;
  border: none;
  border-radius: 0.5rem;
  color: #1a1a2e;
  font-weight: 600;
  cursor: pointer;
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
