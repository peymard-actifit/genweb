<script setup>
/**
 * Vue Table - Jeu de Bridge
 * Affiche un tapis de bridge en perspective 3D (vue depuis SUD)
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { bridgeAIBid, bridgeAIPlayCard } from '@/lib/openai'

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

// Joueurs humains connectés (positions occupées)
const humanPlayers = ref(new Set(['S'])) // Par défaut, seul Sud est humain

// Vérifier si une position est jouée par l'IA
function isAIPlayer(position) {
  return !humanPlayers.value.has(position)
}

// État de l'IA
const aiThinking = ref(false)
const aiDelay = 1500 // Délai en ms avant que l'IA joue

// État du jeu
const currentPhase = ref('bidding') // 'waiting', 'bidding', 'playing', 'finished'
const currentDealNumber = ref(1)
const currentDealer = ref('N') // Donneur de la donne en cours
const currentTurn = ref('N') // À qui c'est de jouer/enchérir (le donneur commence les enchères)
const bids = ref([]) // Liste des enchères: { position, bid, timestamp }
const declarer = ref(null) // Le déclarant
const leader = ref(null) // L'entameur (à gauche du déclarant)
const contract = ref(null) // Le contrat final (ex: '4♠')
const contractLevel = ref(null) // Niveau du contrat (1-7)
const contractSuit = ref(null) // Couleur du contrat (♠, ♥, ♦, ♣, SA)
const isDoubled = ref(false)
const isRedoubled = ref(false)
const consecutivePasses = ref(0) // Compteur de passes consécutifs
const lastRealBid = ref(null) // Dernière enchère non-passe

// Cartes de tous les joueurs (pour l'affichage final)
const allHands = ref({
  N: [],
  E: [],
  S: [],
  W: []
})

// Cartes jouées dans le pli en cours (devant chaque joueur)
const currentTrickCards = ref({
  N: null, // { rank: 'A', suit: '♠' }
  E: null,
  S: null,
  W: null
})

// Plis gagnés par le joueur (NS)
const myTricks = ref([])
const tricksWonNS = ref(0)
const tricksWonEW = ref(0)
const tricksPlayed = ref(0)

// Rotation des joueurs (sens horaire)
const nextPlayer = { 'N': 'E', 'E': 'S', 'S': 'W', 'W': 'N' }
const previousPlayer = { 'N': 'W', 'E': 'N', 'S': 'E', 'W': 'S' }

// Vérifie si les enchères sont terminées
function checkBiddingEnd() {
  if (bids.value.length < 4) return false
  
  // 4 passes consécutifs = tout le monde passe, pas de contrat
  if (consecutivePasses.value >= 4 && !lastRealBid.value) {
    return true
  }
  
  // 3 passes après une enchère = contrat trouvé
  if (consecutivePasses.value >= 3 && lastRealBid.value) {
    return true
  }
  
  return false
}

// Détermine le déclarant (premier du camp à avoir nommé la couleur du contrat)
function findDeclarer() {
  if (!lastRealBid.value) return null
  
  const contractSuitValue = contractSuit.value
  const winningCamp = (lastRealBid.value.position === 'N' || lastRealBid.value.position === 'S') ? ['N', 'S'] : ['E', 'W']
  
  // Trouver le premier joueur du camp gagnant à avoir nommé cette couleur
  for (const bid of bids.value) {
    if (winningCamp.includes(bid.position) && bid.bid !== 'Passe' && bid.bid !== 'Contre' && bid.bid !== 'Surcontre') {
      const bidSuit = bid.bid.length > 1 ? bid.bid.substring(1) : null
      if (bidSuit === contractSuitValue) {
        return bid.position
      }
    }
  }
  
  return lastRealBid.value.position
}

// Termine les enchères et passe au jeu de la carte
function endBidding() {
  if (!lastRealBid.value) {
    // Tous passent - pas de contrat
    contract.value = 'Passé'
    currentPhase.value = 'finished'
    return
  }
  
  // Extraire le contrat
  contractLevel.value = parseInt(lastRealBid.value.bid[0])
  contractSuit.value = lastRealBid.value.bid.substring(1)
  contract.value = lastRealBid.value.bid + (isDoubled.value ? ' X' : '') + (isRedoubled.value ? ' XX' : '')
  
  // Trouver le déclarant
  declarer.value = findDeclarer()
  
  // L'entameur est à gauche du déclarant
  leader.value = nextPlayer[declarer.value]
  currentTurn.value = leader.value
  
  // Passer à la phase de jeu
  currentPhase.value = 'playing'
  
  console.log(`Contrat: ${contract.value}, Déclarant: ${declarer.value}, Entame: ${leader.value}`)
}

// Simuler des cartes jouées pour la démo
function simulateTrickCards() {
  currentTrickCards.value = {
    N: { rank: 'K', suit: '♠' },
    E: { rank: '10', suit: '♠' },
    S: null,
    W: { rank: '5', suit: '♠' }
  }
}

// Collecter le pli
function collectTrick(winner) {
  const isWon = winner === 'N' || winner === 'S'
  
  myTricks.value.push({
    won: isWon,
    cards: { ...currentTrickCards.value }
  })
  
  if (isWon) {
    tricksWonNS.value++
  } else {
    tricksWonEW.value++
  }
  
  tricksPlayed.value++
  
  // Vérifier si le coup est terminé (13 plis)
  if (tricksPlayed.value >= 13) {
    endDeal()
    return
  }
  
  // Le gagnant du pli joue en premier
  currentTurn.value = winner
  currentTrickCards.value = { N: null, E: null, S: null, W: null }
}

// Fin du coup - afficher les 4 jeux
function endDeal() {
  currentPhase.value = 'finished'
  console.log(`Fin du coup - NS: ${tricksWonNS.value}, EW: ${tricksWonEW.value}`)
}

// Passer à la donne suivante
function nextDeal() {
  currentDealNumber.value++
  currentDealer.value = nextPlayer[currentDealer.value]
  currentTurn.value = currentDealer.value
  currentPhase.value = 'bidding'
  
  // Réinitialiser l'état
  bids.value = []
  contract.value = null
  declarer.value = null
  leader.value = null
  consecutivePasses.value = 0
  lastRealBid.value = null
  isDoubled.value = false
  isRedoubled.value = false
  currentTrickCards.value = { N: null, E: null, S: null, W: null }
  myTricks.value = []
  tricksWonNS.value = 0
  tricksWonEW.value = 0
  tricksPlayed.value = 0
  
  // Redistribuer les cartes à tous les joueurs
  distributeCards()
  
  // Vérifier si l'IA doit jouer en premier
  checkAITurn()
}

// Distribution des cartes à tous les joueurs
function distributeCards() {
  const deck = []
  const suits = ['♠', '♥', '♦', '♣']
  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
  
  // Créer le jeu complet
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit, id: `${rank}${suit}` })
    }
  }
  
  // Mélanger
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  
  // Distribuer 13 cartes à chaque joueur
  const positions = ['N', 'E', 'S', 'W']
  positions.forEach((pos, index) => {
    const hand = deck.slice(index * 13, (index + 1) * 13)
    // Trier par couleur puis par rang
    hand.sort((a, b) => {
      const suitOrder = suits.indexOf(a.suit) - suits.indexOf(b.suit)
      if (suitOrder !== 0) return suitOrder
      return ranks.indexOf(a.rank) - ranks.indexOf(b.rank)
    })
    allHands.value[pos] = hand
  })
  
  // Mettre à jour la main du joueur connecté
  if (myPosition.value) {
    myCards.value = allHands.value[myPosition.value]
  }
}

// Vérifier si c'est à l'IA de jouer
function checkAITurn() {
  if (currentPhase.value === 'finished' || currentPhase.value === 'waiting') return
  if (!isAIPlayer(currentTurn.value)) return
  
  console.log(`[IA] C'est au tour de ${currentTurn.value} (IA)`)
  
  // Délai pour simuler la réflexion
  aiThinking.value = true
  setTimeout(async () => {
    if (currentPhase.value === 'bidding') {
      await makeAIBid()
    } else if (currentPhase.value === 'playing') {
      await makeAIPlayCard()
    }
    aiThinking.value = false
  }, aiDelay)
}

// L'IA fait une enchère
async function makeAIBid() {
  const position = currentTurn.value
  const hand = allHands.value[position]
  
  const context = {
    hand,
    bids: bids.value,
    position,
    vulnerability: vulnerability.value,
    dealer: currentDealer.value,
    lastBid: lastRealBid.value?.bid || null
  }
  
  try {
    const bid = await bridgeAIBid(context)
    console.log(`[IA ${position}] Enchère: ${bid}`)
    
    // Enregistrer l'enchère
    processBid(position, bid)
  } catch (err) {
    console.error('Erreur IA enchère:', err)
    processBid(position, 'Passe')
  }
}

// L'IA joue une carte
async function makeAIPlayCard() {
  const position = currentTurn.value
  const hand = allHands.value[position]
  
  // Déterminer la couleur demandée
  const leadPosition = leader.value
  let leadSuit = null
  
  // Trouver la première carte du pli
  const playOrder = getPlayOrder()
  for (const pos of playOrder) {
    if (currentTrickCards.value[pos]) {
      leadSuit = currentTrickCards.value[pos].suit
      break
    }
  }
  
  const context = {
    hand,
    trick: currentTrickCards.value,
    position,
    contract: contract.value,
    trumpSuit: contractSuit.value === 'SA' ? null : contractSuit.value,
    leadSuit
  }
  
  try {
    const card = await bridgeAIPlayCard(context)
    console.log(`[IA ${position}] Joue: ${card?.rank}${card?.suit}`)
    
    if (card) {
      processPlayCard(position, card)
    }
  } catch (err) {
    console.error('Erreur IA carte:', err)
    // Jouer la première carte valide
    if (hand.length > 0) {
      processPlayCard(position, hand[0])
    }
  }
}

// Ordre de jeu dans le pli actuel
function getPlayOrder() {
  const start = leader.value || currentDealer.value
  const order = []
  let pos = start
  for (let i = 0; i < 4; i++) {
    order.push(pos)
    pos = nextPlayer[pos]
  }
  return order
}

// Traiter une enchère (utilisé par humain et IA)
function processBid(position, bid) {
  bids.value.push({
    position,
    bid,
    timestamp: new Date()
  })
  
  if (bid === 'Passe') {
    consecutivePasses.value++
  } else if (bid === 'Contre') {
    consecutivePasses.value = 0
    isDoubled.value = true
    isRedoubled.value = false
  } else if (bid === 'Surcontre') {
    consecutivePasses.value = 0
    isRedoubled.value = true
  } else {
    consecutivePasses.value = 0
    lastRealBid.value = { position, bid }
    isDoubled.value = false
    isRedoubled.value = false
  }
  
  if (checkBiddingEnd()) {
    endBidding()
    // Après la fin des enchères, vérifier si l'IA doit entamer
    setTimeout(() => checkAITurn(), aiDelay)
    return
  }
  
  currentTurn.value = nextPlayer[currentTurn.value]
  
  // Vérifier si l'IA doit jouer
  checkAITurn()
}

// Traiter une carte jouée (utilisé par humain et IA)
function processPlayCard(position, card) {
  // Retirer la carte de la main
  const handIndex = allHands.value[position].findIndex(
    c => c.rank === card.rank && c.suit === card.suit
  )
  if (handIndex !== -1) {
    allHands.value[position].splice(handIndex, 1)
  }
  
  // Mettre à jour la main du joueur si c'est lui
  if (position === myPosition.value) {
    myCards.value = allHands.value[position]
  }
  
  // Ajouter la carte au pli
  currentTrickCards.value[position] = card
  
  // Vérifier si le pli est complet
  const cardsPlayed = Object.values(currentTrickCards.value).filter(c => c !== null).length
  
  if (cardsPlayed === 4) {
    // Déterminer le gagnant du pli
    setTimeout(() => {
      const winner = determineTrickWinner()
      collectTrick(winner)
      
      // Vérifier si l'IA doit jouer le pli suivant
      setTimeout(() => checkAITurn(), 500)
    }, 1500) // Délai pour voir les cartes
  } else {
    // Passer au joueur suivant
    currentTurn.value = nextPlayer[currentTurn.value]
    checkAITurn()
  }
}

// Déterminer le gagnant du pli
function determineTrickWinner() {
  const trumpSuit = contractSuit.value === 'SA' ? null : contractSuit.value
  const playOrder = getPlayOrder()
  const leadSuit = currentTrickCards.value[playOrder[0]]?.suit
  
  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  
  let winner = playOrder[0]
  let winningCard = currentTrickCards.value[winner]
  
  for (let i = 1; i < 4; i++) {
    const pos = playOrder[i]
    const card = currentTrickCards.value[pos]
    
    if (!card) continue
    
    const currentWins = compareCards(winningCard, card, leadSuit, trumpSuit, rankOrder)
    if (!currentWins) {
      winner = pos
      winningCard = card
    }
  }
  
  return winner
}

// Compare deux cartes, retourne true si card1 gagne
function compareCards(card1, card2, leadSuit, trumpSuit, rankOrder) {
  // Si card2 est atout et card1 non
  if (trumpSuit && card2.suit === trumpSuit && card1.suit !== trumpSuit) {
    return false
  }
  
  // Si card1 est atout et card2 non
  if (trumpSuit && card1.suit === trumpSuit && card2.suit !== trumpSuit) {
    return true
  }
  
  // Si les deux sont atout ou les deux sont de la couleur demandée
  if (card1.suit === card2.suit) {
    return rankOrder.indexOf(card1.rank) > rankOrder.indexOf(card2.rank)
  }
  
  // Si card2 n'est pas de la couleur demandée (et pas atout)
  if (card2.suit !== leadSuit && card2.suit !== trumpSuit) {
    return true
  }
  
  // Si card1 n'est pas de la couleur demandée
  if (card1.suit !== leadSuit) {
    return false
  }
  
  return true
}

// Vulnérabilité par camp (NS = Nord-Sud, EW = Est-Ouest)
// Selon les règles du bridge: donne 1 = personne, 2 = NS, 3 = EW, 4 = tous, puis cycle
const vulnerability = computed(() => {
  const deal = ((currentDealNumber.value - 1) % 16) + 1
  const vulnPattern = {
    1: { NS: false, EW: false },
    2: { NS: true, EW: false },
    3: { NS: false, EW: true },
    4: { NS: true, EW: true },
    5: { NS: true, EW: false },
    6: { NS: false, EW: true },
    7: { NS: true, EW: true },
    8: { NS: false, EW: false },
    9: { NS: false, EW: true },
    10: { NS: true, EW: true },
    11: { NS: false, EW: false },
    12: { NS: true, EW: false },
    13: { NS: true, EW: true },
    14: { NS: false, EW: false },
    15: { NS: true, EW: false },
    16: { NS: false, EW: true }
  }
  return vulnPattern[deal]
})

// Vérifie si un joueur est vulnérable
function isVulnerable(position) {
  if (position === 'N' || position === 'S') {
    return vulnerability.value.NS
  }
  return vulnerability.value.EW
}

// Enchères sélectionnées pour affichage agrandi
const hoveredBid = ref(null)
const selectedBids = ref([]) // Enchères sélectionnées pour comparaison

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

// Gestion des enchères agrandies
function hoverBid(bid) {
  hoveredBid.value = bid
}

function unhoverBid() {
  hoveredBid.value = null
}

function selectBidForComparison(bid, event) {
  event.stopPropagation()
  if (selectedBids.value.includes(bid)) {
    selectedBids.value = selectedBids.value.filter(b => b !== bid)
  } else if (selectedBids.value.length < 2) {
    selectedBids.value.push(bid)
  }
}

function clearSelectedBids() {
  selectedBids.value = []
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
  if (currentTurn.value !== myPosition.value) {
    console.log('Ce n\'est pas votre tour')
    return
  }
  
  // Vérifier si le joueur doit fournir à la couleur
  const playOrder = getPlayOrder()
  let leadSuit = null
  for (const pos of playOrder) {
    if (currentTrickCards.value[pos]) {
      leadSuit = currentTrickCards.value[pos].suit
      break
    }
  }
  
  if (leadSuit && card.suit !== leadSuit) {
    // Vérifier si le joueur a la couleur demandée
    const hasLeadSuit = myCards.value.some(c => c.suit === leadSuit)
    if (hasLeadSuit) {
      console.log('Vous devez fournir à la couleur:', leadSuit)
      return
    }
  }
  
  console.log('Jouer carte:', card.rank + card.suit)
  processPlayCard(myPosition.value, card)
}

async function makeBid(bid) {
  if (currentPhase.value !== 'bidding') return
  if (currentTurn.value !== myPosition.value) {
    console.log('Ce n\'est pas votre tour d\'enchérir')
    return
  }
  
  console.log('Enchère:', bid, 'par', myPosition.value)
  processBid(myPosition.value, bid)
}

// Ordre de jeu pour une donne
const dealerRotation = ['N', 'E', 'S', 'W']

function getNextDealer() {
  const currentIndex = dealerRotation.indexOf(currentDealer.value)
  return dealerRotation[(currentIndex + 1) % 4]
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
  // Position du joueur connecté
  myPosition.value = 'S'
  // Distribuer les cartes à tous les joueurs
  distributeCards()
  // Démarrer en phase d'enchères, le donneur (N) commence
  currentPhase.value = 'bidding'
  currentDealer.value = 'N'
  currentTurn.value = 'N'
  
  // L'IA joue si le donneur n'est pas humain
  setTimeout(() => checkAITurn(), 1000)
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
      <!-- Header compact avec numéro de donne et contrat -->
      <div class="table-header">
        <div class="deal-info">
          <span class="deal-number">Donne {{ currentDealNumber }}</span>
          <span class="dealer-info">Donneur: {{ currentDealer }}</span>
          <span v-if="contract" class="contract-info">
            Contrat: <strong>{{ contract }}</strong>
            <span v-if="declarer"> par {{ declarer }}</span>
          </span>
        </div>
        <button class="btn-leave" @click="leaveTable">← Quitter</button>
        <h3>{{ currentTable.name }}</h3>
        <span class="phase-badge" :class="{ 
          'phase-bidding': currentPhase === 'bidding',
          'phase-playing': currentPhase === 'playing',
          'phase-finished': currentPhase === 'finished'
        }">
          {{ currentPhase === 'waiting' ? 'En attente' : currentPhase === 'bidding' ? 'Enchères' : currentPhase === 'playing' ? 'Jeu de la carte' : 'Fin du coup' }}
        </span>
        <span v-if="aiThinking" class="ai-thinking">
          🤖 {{ currentTurn }} réfléchit...
        </span>
      </div>
      
      <!-- Zone vidéo NORD (haut de l'écran) -->
      <div class="video-zone video-north">
        <div 
          class="video-content"
          :class="{ 
            'is-turn': currentTurn === 'N',
            'vulnerable': isVulnerable('N'),
            'not-vulnerable': !isVulnerable('N')
          }"
        >
          <div class="video-placeholder">
            <span v-if="isAIPlayer('N')" class="ai-badge">🤖</span>
          </div>
          <div class="video-controls">
            <button @click="toggleVideo('N')" :class="{ off: !videoControls.N.video }">
              {{ videoControls.N.video ? '📹' : '📷' }}
            </button>
            <button @click="toggleAudio('N')" :class="{ off: !videoControls.N.audio }">
              {{ videoControls.N.audio ? '🔊' : '🔇' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Zone vidéo OUEST (gauche de l'écran) -->
      <div class="video-zone video-west">
        <div 
          class="video-content"
          :class="{ 
            'is-turn': currentTurn === 'W',
            'vulnerable': isVulnerable('W'),
            'not-vulnerable': !isVulnerable('W')
          }"
        >
          <div class="video-placeholder">
            <span v-if="isAIPlayer('W')" class="ai-badge">🤖</span>
          </div>
          <div class="video-controls">
            <button @click="toggleVideo('W')" :class="{ off: !videoControls.W.video }">
              {{ videoControls.W.video ? '📹' : '📷' }}
            </button>
            <button @click="toggleAudio('W')" :class="{ off: !videoControls.W.audio }">
              {{ videoControls.W.audio ? '🔊' : '🔇' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Zone vidéo EST (droite de l'écran) -->
      <div class="video-zone video-east">
        <div 
          class="video-content"
          :class="{ 
            'is-turn': currentTurn === 'E',
            'vulnerable': isVulnerable('E'),
            'not-vulnerable': !isVulnerable('E')
          }"
        >
          <div class="video-placeholder">
            <span v-if="isAIPlayer('E')" class="ai-badge">🤖</span>
          </div>
          <div class="video-controls">
            <button @click="toggleVideo('E')" :class="{ off: !videoControls.E.video }">
              {{ videoControls.E.video ? '📹' : '📷' }}
            </button>
            <button @click="toggleAudio('E')" :class="{ off: !videoControls.E.audio }">
              {{ videoControls.E.audio ? '🔊' : '🔇' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Tapis de bridge central -->
      <div class="table-center">
        <div class="table-felt">
          <!-- Labels d'orientation sur la table (en face de chaque joueur) -->
          <span class="table-position-label pos-north">N</span>
          <span class="table-position-label pos-west">O</span>
          <span class="table-position-label pos-east">E</span>
          
          <!-- Cartes jouées DEVANT chaque joueur (agrandies) -->
          <div v-if="currentPhase === 'playing'" class="played-cards-area">
            <!-- Carte Nord (en haut, devant le Nord) -->
            <div class="played-card-zone north-zone">
              <div 
                v-if="currentTrickCards.N" 
                class="played-card-large"
                :class="{ 'suit-red': currentTrickCards.N.suit === '♥' || currentTrickCards.N.suit === '♦' }"
              >
                <span class="card-rank">{{ currentTrickCards.N.rank }}</span>
                <span class="card-suit">{{ currentTrickCards.N.suit }}</span>
              </div>
            </div>
            
            <!-- Carte Ouest (à gauche, devant l'Ouest) -->
            <div class="played-card-zone west-zone">
              <div 
                v-if="currentTrickCards.W" 
                class="played-card-large"
                :class="{ 'suit-red': currentTrickCards.W.suit === '♥' || currentTrickCards.W.suit === '♦' }"
              >
                <span class="card-rank">{{ currentTrickCards.W.rank }}</span>
                <span class="card-suit">{{ currentTrickCards.W.suit }}</span>
              </div>
            </div>
            
            <!-- Carte Est (à droite, devant l'Est) -->
            <div class="played-card-zone east-zone">
              <div 
                v-if="currentTrickCards.E" 
                class="played-card-large"
                :class="{ 'suit-red': currentTrickCards.E.suit === '♥' || currentTrickCards.E.suit === '♦' }"
              >
                <span class="card-rank">{{ currentTrickCards.E.rank }}</span>
                <span class="card-suit">{{ currentTrickCards.E.suit }}</span>
              </div>
            </div>
            
            <!-- Carte Sud (en bas, devant le Sud / joueur connecté) -->
            <div class="played-card-zone south-zone">
              <div 
                v-if="currentTrickCards.S" 
                class="played-card-large"
                :class="{ 'suit-red': currentTrickCards.S.suit === '♥' || currentTrickCards.S.suit === '♦' }"
              >
                <span class="card-rank">{{ currentTrickCards.S.rank }}</span>
                <span class="card-suit">{{ currentTrickCards.S.suit }}</span>
              </div>
            </div>
          </div>
          
          <!-- Plis du joueur (NS) - empilés comme au bridge -->
          <div class="my-tricks-zone">
            <div 
              v-for="(trick, index) in myTricks" 
              :key="index"
              class="trick-pile"
              :class="{ 'trick-won': trick.won, 'trick-lost': !trick.won }"
              :style="{ '--trick-index': index }"
            >
              <div class="trick-card"></div>
            </div>
          </div>
          
          <!-- Score des plis -->
          <div v-if="currentPhase === 'playing' || currentPhase === 'finished'" class="tricks-score">
            <span class="score-ns">NS: {{ tricksWonNS }}</span>
            <span class="score-ew">EW: {{ tricksWonEW }}</span>
          </div>
          
          <!-- Affichage des 4 jeux à la fin du coup -->
          <div v-if="currentPhase === 'finished'" class="all-hands-display">
            <div class="final-message">
              <div class="result-title">Fin du coup</div>
              <div class="result-score">NS: {{ tricksWonNS }} plis - EW: {{ tricksWonEW }} plis</div>
              <button class="btn-next-deal" @click="nextDeal">
                Donne suivante →
              </button>
            </div>
          </div>
          
          <!-- Boîte à enchères (seulement pendant les enchères) -->
          <div v-if="currentPhase === 'bidding'" class="bidding-box-on-table">
            <div class="bid-grid">
              <div v-for="level in bidLevels" :key="level" class="bid-row">
                <button 
                  v-for="suit in bidSuits" 
                  :key="`${level}${suit}`"
                  class="bid-btn"
                  :class="{ 
                    'suit-clubs': suit === '♣', 
                    'suit-diamonds': suit === '♦', 
                    'suit-hearts': suit === '♥', 
                    'suit-spades': suit === '♠', 
                    'suit-nt': suit === 'SA',
                    'is-hovered': hoveredBid === `${level}${suit}`,
                    'is-selected': selectedBids.includes(`${level}${suit}`)
                  }"
                  @mouseenter="hoverBid(`${level}${suit}`)"
                  @mouseleave="unhoverBid()"
                  @click="makeBid(`${level}${suit}`)"
                  @contextmenu.prevent="selectBidForComparison(`${level}${suit}`, $event)"
                >
                  {{ level }}{{ suit }}
                </button>
              </div>
            </div>
            <div class="special-bids">
              <button 
                v-for="bid in specialBids" 
                :key="bid" 
                class="bid-btn special"
                :class="{ 
                  'is-hovered': hoveredBid === bid,
                  'is-selected': selectedBids.includes(bid)
                }"
                @mouseenter="hoverBid(bid)"
                @mouseleave="unhoverBid()"
                @click="makeBid(bid)"
                @contextmenu.prevent="selectBidForComparison(bid, $event)"
              >
                {{ bid }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Enchères agrandies (au survol ou sélectionnées) -->
        <div v-if="(hoveredBid || selectedBids.length > 0) && currentPhase === 'bidding'" class="enlarged-bids">
          <div v-if="hoveredBid && !selectedBids.includes(hoveredBid)" class="enlarged-bid hovered">
            <span class="bid-level">{{ hoveredBid }}</span>
          </div>
          <div v-for="bid in selectedBids" :key="bid" class="enlarged-bid selected" @click="selectBidForComparison(bid, $event)">
            <span class="bid-level">{{ bid }}</span>
            <button class="remove-bid" @click.stop="selectBidForComparison(bid, $event)">×</button>
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
          <div 
            class="video-content"
            :class="{ 
              'is-turn': currentTurn === 'S',
              'vulnerable': isVulnerable('S'),
              'not-vulnerable': !isVulnerable('S')
            }"
          >
            <div class="video-placeholder"></div>
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

.deal-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.deal-number {
  font-size: 1.1rem;
  font-weight: bold;
  color: #fbbf24;
}

.dealer-info {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.contract-info {
  font-size: 0.9rem;
  color: #4ade80;
  margin-top: 0.1rem;
}

.contract-info strong {
  color: #fbbf24;
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

.phase-badge.phase-bidding {
  background: #fbbf24;
}

.phase-badge.phase-playing {
  background: #4ade80;
}

.phase-badge.phase-finished {
  background: #a855f7;
}

.ai-thinking {
  padding: 0.25rem 0.75rem;
  background: rgba(139, 92, 246, 0.3);
  border: 1px solid #8b5cf6;
  border-radius: 1rem;
  font-size: 0.75rem;
  color: #c4b5fd;
  animation: ai-pulse 1s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ================================
   ZONES VIDÉO
   ================================ */
.video-zone {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  position: relative;
  align-items: center;
  justify-content: center;
}

.video-north {
  grid-area: north;
}

.video-west {
  grid-area: west;
}

.video-east {
  grid-area: east;
}

.video-content {
  width: 160px;
  height: 120px;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.2);
  background: #1a1a2e;
  position: relative;
  transition: border-color 0.3s;
}

/* Vulnérabilité - bordure verte ou rouge */
.video-content.not-vulnerable {
  border-color: #22c55e;
}

.video-content.vulnerable {
  border-color: #ef4444;
}

/* Tour du joueur - bordure clignotante */
.video-content.is-turn {
  animation: turn-blink 1s infinite;
}

.video-content.is-turn.not-vulnerable {
  animation: turn-blink-green 1s infinite;
}

.video-content.is-turn.vulnerable {
  animation: turn-blink-red 1s infinite;
}

@keyframes turn-blink-green {
  0%, 100% { 
    border-color: #22c55e;
    box-shadow: 0 0 10px #22c55e, 0 0 20px #22c55e;
  }
  50% { 
    border-color: #86efac;
    box-shadow: 0 0 20px #22c55e, 0 0 40px #22c55e;
  }
}

@keyframes turn-blink-red {
  0%, 100% { 
    border-color: #ef4444;
    box-shadow: 0 0 10px #ef4444, 0 0 20px #ef4444;
  }
  50% { 
    border-color: #fca5a5;
    box-shadow: 0 0 20px #ef4444, 0 0 40px #ef4444;
  }
}


.video-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2d3748, #1a202c);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-badge {
  font-size: 2rem;
  opacity: 0.6;
}

.video-controls {
  position: absolute;
  bottom: 0.25rem;
  right: 0.25rem;
  display: flex;
  gap: 0.2rem;
}

.video-controls button {
  padding: 0.2rem 0.35rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 0.2rem;
  cursor: pointer;
  font-size: 0.75rem;
}

.video-controls button:hover {
  background: rgba(0, 0, 0, 0.8);
}

.video-controls button.off {
  background: rgba(239, 68, 68, 0.6);
  border-color: rgba(239, 68, 68, 0.8);
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


/* Labels d'orientation sur la table */
.table-position-label {
  position: absolute;
  font-size: 1.5rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.4);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 5;
  pointer-events: none;
}

.table-position-label.pos-north {
  top: 8%;
  left: 50%;
  transform: translateX(-50%);
}

.table-position-label.pos-south {
  bottom: 8%;
  left: 50%;
  transform: translateX(-50%);
}

.table-position-label.pos-east {
  right: 8%;
  top: 50%;
  transform: translateY(-50%);
}

.table-position-label.pos-west {
  left: 8%;
  top: 50%;
  transform: translateY(-50%);
}

/* ================================
   CARTES JOUÉES DEVANT CHAQUE JOUEUR
   ================================ */
.played-cards-area {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.played-card-zone {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.played-card-zone.north-zone {
  top: 12%;
  left: 50%;
  transform: translateX(-50%);
}

.played-card-zone.south-zone {
  bottom: 12%;
  left: 50%;
  transform: translateX(-50%);
}

.played-card-zone.west-zone {
  left: 12%;
  top: 50%;
  transform: translateY(-50%);
}

.played-card-zone.east-zone {
  right: 12%;
  top: 50%;
  transform: translateY(-50%);
}

.played-card-large {
  width: 55px;
  height: 77px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: card-appear 0.3s ease-out;
}

@keyframes card-appear {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.played-card-large .card-rank {
  font-size: 1.3rem;
  font-weight: bold;
  color: #1a1a2e;
}

.played-card-large .card-suit {
  font-size: 1.6rem;
}

.played-card-large.suit-red .card-rank,
.played-card-large.suit-red .card-suit {
  color: #dc2626;
}

/* ================================
   PLIS DU JOUEUR (comme au bridge)
   ================================ */
.my-tricks-zone {
  position: absolute;
  bottom: 5%;
  right: 5%;
  display: flex;
  gap: 2px;
}

.trick-pile {
  position: relative;
}

/* Pli gagné = vertical */
.trick-pile.trick-won .trick-card {
  width: 20px;
  height: 28px;
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  border: 1px solid #60a5fa;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Pli perdu = horizontal */
.trick-pile.trick-lost .trick-card {
  width: 28px;
  height: 20px;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border: 1px solid #c084fc;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Score des plis */
.tricks-score {
  position: absolute;
  top: 5%;
  right: 5%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: bold;
}

.tricks-score .score-ns {
  color: #4ade80;
}

.tricks-score .score-ew {
  color: #f87171;
}

/* Affichage final du coup */
.all-hands-display {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 20;
}

.final-message {
  background: rgba(30, 41, 59, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
}

.result-title {
  font-size: 1.5rem;
  font-weight: bold;
  color: #fbbf24;
  margin-bottom: 1rem;
}

.result-score {
  font-size: 1.1rem;
  color: white;
  margin-bottom: 1.5rem;
}

.btn-next-deal {
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, #4ade80, #22c55e);
  border: none;
  border-radius: 0.5rem;
  color: #1a1a2e;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-next-deal:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
}

/* ================================
   BOÎTE À ENCHÈRES SUR LA TABLE
   ================================ */
.bidding-box-on-table {
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 0.5rem;
  padding: 0.5rem;
  z-index: 10;
}

.bidding-box-on-table .bid-grid {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bidding-box-on-table .bid-row {
  display: flex;
  gap: 0.15rem;
}

.bidding-box-on-table .bid-btn {
  width: 32px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transition: all 0.15s;
}

.bidding-box-on-table .bid-btn:hover,
.bidding-box-on-table .bid-btn.is-hovered {
  transform: scale(1.3);
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.bidding-box-on-table .bid-btn.is-selected {
  background: rgba(251, 191, 36, 0.4);
  border-color: #fbbf24;
}

.bidding-box-on-table .bid-btn.suit-clubs { color: #22c55e; }
.bidding-box-on-table .bid-btn.suit-diamonds { color: #f97316; }
.bidding-box-on-table .bid-btn.suit-hearts { color: #ef4444; }
.bidding-box-on-table .bid-btn.suit-spades { color: #3b82f6; }
.bidding-box-on-table .bid-btn.suit-nt { color: #a855f7; }

.bidding-box-on-table .special-bids {
  display: flex;
  gap: 0.15rem;
  margin-top: 0.3rem;
}

.bidding-box-on-table .bid-btn.special {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.55rem;
}

/* Enchères agrandies */
.enlarged-bids {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 0.5rem;
  z-index: 100;
}

.enlarged-bid {
  width: 80px;
  height: 100px;
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  position: relative;
}

.enlarged-bid.hovered {
  border: 3px solid #3b82f6;
}

.enlarged-bid.selected {
  border: 3px solid #fbbf24;
  cursor: pointer;
}

.enlarged-bid .bid-level {
  font-size: 1.8rem;
  font-weight: bold;
  color: #1a1a2e;
}

.enlarged-bid .remove-bid {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #ef4444;
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

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
  justify-content: center;
}

.my-video-zone .video-content {
  width: 180px;
  height: 120px;
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
