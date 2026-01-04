// Service OpenAI pour les calculs IA
// La clé API est stockée côté client pour ce projet (à améliorer avec un backend)

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

/**
 * Exécute un prompt avec les données fournies via l'API OpenAI
 * @param {string} prompt - Le prompt utilisateur
 * @param {Array} dataSources - Les sources de données disponibles
 * @returns {Promise<string>} - Le résultat du calcul
 */
export async function executePrompt(prompt, dataSources = []) {
  if (!OPENAI_API_KEY) {
    throw new Error('Clé API OpenAI non configurée. Ajoutez VITE_OPENAI_API_KEY dans vos variables d\'environnement.')
  }

  // Préparer le contexte système et les données
  const systemContext = getSystemContext()
  const dataContext = prepareDataContext(dataSources)
  
  // Construire le message système
  const systemMessage = `Tu es un assistant spécialisé dans l'analyse de données et les calculs.
Tu reçois des données provenant de différentes sources (fichiers Excel, CSV, JSON, emails, texte).
Tu as également accès aux informations système actuelles.
Tu dois répondre de manière concise et précise aux demandes de calcul ou d'extraction.
Retourne uniquement le résultat demandé, sans explication supplémentaire, sauf si explicitement demandé.
Si tu ne peux pas effectuer le calcul avec les données fournies, indique-le clairement.

INFORMATIONS SYSTÈME:
${systemContext}

DONNÉES DISPONIBLES:
${dataContext}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Erreur API: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content?.trim() || 'Pas de résultat'
  } catch (err) {
    console.error('Erreur OpenAI:', err)
    throw err
  }
}

/**
 * Récupère le contexte système (date, heure, infos navigateur)
 * @returns {string} - Les informations système formatées
 */
function getSystemContext() {
  const now = new Date()
  
  // Formatage de la date en français
  const dateOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  
  const dateStr = now.toLocaleDateString('fr-FR', dateOptions)
  const timeStr = now.toLocaleTimeString('fr-FR', timeOptions)
  const isoDate = now.toISOString().split('T')[0] // Format YYYY-MM-DD
  
  // Informations sur le fuseau horaire
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  
  // Informations navigateur (si disponibles)
  const browserInfo = typeof navigator !== 'undefined' ? {
    langue: navigator.language || 'inconnu',
    plateforme: navigator.platform || 'inconnu',
    enLigne: navigator.onLine ? 'Oui' : 'Non'
  } : {}
  
  let context = `- Date du jour: ${dateStr}
- Date ISO: ${isoDate}
- Heure actuelle: ${timeStr}
- Fuseau horaire: ${timezone}`
  
  if (browserInfo.langue) {
    context += `
- Langue: ${browserInfo.langue}
- Plateforme: ${browserInfo.plateforme}
- Connexion internet: ${browserInfo.enLigne}`
  }
  
  return context
}

/**
 * Prépare le contexte des données pour le prompt
 * @param {Array} dataSources - Les sources de données
 * @returns {string} - Le contexte formaté
 */
function prepareDataContext(dataSources) {
  if (!dataSources || dataSources.length === 0) {
    return 'Aucune donnée disponible.'
  }

  return dataSources
    .filter(source => source.status === 'ready' && source.data)
    .map(source => {
      // Utiliser la référence si disponible, sinon le nom
      const ref = source.ref || source.name
      const category = source.category ? `[${source.category}]` : ''
      const header = `\n=== ${ref}: ${source.name} ${category} ===\n`
      
      // Formater les données selon le type
      let content = ''
      
      if (typeof source.data === 'string') {
        // CSV, JSON, texte, email
        content = truncateData(source.data, 3000)
      } else if (source.data instanceof ArrayBuffer) {
        // Fichiers binaires (Excel) - on ne peut pas les lire directement côté client
        content = '[Fichier binaire - contenu non extrait. Utilisez un fichier CSV pour les données tabulaires.]'
      } else {
        content = JSON.stringify(source.data, null, 2)
      }
      
      return header + content
    })
    .join('\n')
}

/**
 * Tronque les données trop longues
 * @param {string} data - Les données
 * @param {number} maxLength - Longueur max
 * @returns {string} - Données tronquées
 */
function truncateData(data, maxLength = 3000) {
  if (data.length <= maxLength) return data
  return data.substring(0, maxLength) + '\n... [données tronquées]'
}

/**
 * Vérifie si la clé API est configurée
 * @returns {boolean}
 */
export function isConfigured() {
  return !!OPENAI_API_KEY
}

/**
 * Parse un fichier CSV en tableau d'objets
 * @param {string} csvContent - Contenu CSV
 * @returns {Array<Object>}
 */
export function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = parseCSVLine(lines[0])
  const data = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || ''
    })
    data.push(row)
  }
  
  return data
}

/**
 * Parse une ligne CSV
 * @param {string} line 
 * @returns {Array<string>}
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

/**
 * IA pour jouer au bridge - Enchères
 * @param {Object} context - Contexte du jeu (main, enchères précédentes, position, vulnérabilité)
 * @returns {Promise<string>} - L'enchère choisie
 */
export async function bridgeAIBid(context) {
  if (!OPENAI_API_KEY) {
    // Fallback: IA simple sans API
    return simpleBridgeBid(context)
  }

  const { hand, bids, position, vulnerability, dealer, lastBid } = context
  
  const systemMessage = `Tu es un joueur de bridge expert. Tu dois choisir une enchère.
Règles:
- Les enchères vont de 1♣ à 7SA (ordre: ♣, ♦, ♥, ♠, SA)
- Tu peux dire "Passe", "Contre" (si l'adversaire a enchéri), ou "Surcontre" (si contré)
- Une enchère doit être plus forte que la précédente
- Réponds UNIQUEMENT par l'enchère, rien d'autre (ex: "1♠", "Passe", "3SA")

Évaluation standard: As=4, Roi=3, Dame=2, Valet=1
- 0-5 points: Passe
- 6-9: Ouvrir au niveau 1 si bonne distribution
- 12-14: Ouvrir 1SA équilibré, ou 1 couleur
- 15-17: 1SA fort
- 20+: 2♣ fort`

  const userMessage = `Position: ${position}
Donneur: ${dealer}
Vulnérabilité: NS=${vulnerability.NS ? 'Oui' : 'Non'}, EW=${vulnerability.EW ? 'Oui' : 'Non'}
Ma main: ${formatHandForAI(hand)}
Enchères précédentes: ${bids.length > 0 ? bids.map(b => `${b.position}:${b.bid}`).join(', ') : 'Aucune'}
Dernière enchère: ${lastBid || 'Aucune'}

Quelle enchère fais-tu?`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5,
        max_tokens: 20
      })
    })

    if (!response.ok) {
      return simpleBridgeBid(context)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content?.trim() || 'Passe'
    
    // Valider et nettoyer la réponse
    return validateBidResponse(aiResponse, context)
  } catch (err) {
    console.error('Erreur IA Bridge (enchères):', err)
    return simpleBridgeBid(context)
  }
}

/**
 * IA pour jouer au bridge - Jeu de la carte
 * @param {Object} context - Contexte du jeu
 * @returns {Promise<Object>} - La carte choisie { rank, suit }
 */
export async function bridgeAIPlayCard(context) {
  if (!OPENAI_API_KEY) {
    return simpleBridgePlayCard(context)
  }

  const { hand, trick, position, contract, trumpSuit, leadSuit } = context
  
  const systemMessage = `Tu es un joueur de bridge expert. Tu dois jouer une carte.
Règles:
- Tu DOIS fournir à la couleur demandée si tu en as
- Si tu n'as pas la couleur, tu peux couper (atout) ou défausser
- Réponds UNIQUEMENT par la carte, format: "rang couleur" (ex: "A♠", "10♥", "K♦")
- Rangs: A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2`

  const userMessage = `Position: ${position}
Contrat: ${contract}
Atout: ${trumpSuit || 'SA'}
Couleur demandée: ${leadSuit || 'Première carte du pli'}
Pli en cours: ${formatTrickForAI(trick)}
Ma main: ${formatHandForAI(hand)}

Quelle carte joues-tu?`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 20
      })
    })

    if (!response.ok) {
      return simpleBridgePlayCard(context)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content?.trim() || ''
    
    return parseCardResponse(aiResponse, hand, leadSuit)
  } catch (err) {
    console.error('Erreur IA Bridge (carte):', err)
    return simpleBridgePlayCard(context)
  }
}

// Fonctions helper pour l'IA bridge

function formatHandForAI(hand) {
  const bySuit = { '♠': [], '♥': [], '♦': [], '♣': [] }
  hand.forEach(card => {
    if (bySuit[card.suit]) {
      bySuit[card.suit].push(card.rank)
    }
  })
  return Object.entries(bySuit)
    .map(([suit, ranks]) => `${suit}: ${ranks.join(' ') || '-'}`)
    .join(' | ')
}

function formatTrickForAI(trick) {
  const cards = []
  for (const [pos, card] of Object.entries(trick)) {
    if (card) {
      cards.push(`${pos}:${card.rank}${card.suit}`)
    }
  }
  return cards.length > 0 ? cards.join(', ') : 'Vide'
}

function validateBidResponse(response, context) {
  const validBids = ['Passe', 'Contre', 'Surcontre']
  const levels = ['1', '2', '3', '4', '5', '6', '7']
  const suits = ['♣', '♦', '♥', '♠', 'SA']
  
  // Nettoyer la réponse
  let bid = response.replace(/["""'']/g, '').trim()
  
  // Vérifier si c'est une enchère spéciale
  if (validBids.includes(bid)) {
    return bid
  }
  
  // Vérifier si c'est une enchère valide (niveau + couleur)
  for (const level of levels) {
    for (const suit of suits) {
      if (bid === `${level}${suit}` || bid.includes(`${level}${suit}`)) {
        return `${level}${suit}`
      }
    }
  }
  
  // Si pas valide, passer
  return 'Passe'
}

function parseCardResponse(response, hand, leadSuit) {
  // Essayer de parser la réponse
  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
  const suits = ['♠', '♥', '♦', '♣']
  
  for (const card of hand) {
    // Vérifier si la réponse contient cette carte
    if (response.includes(card.rank) && response.includes(card.suit)) {
      return card
    }
  }
  
  // Si pas trouvé, jouer une carte valide (fournir à la couleur si possible)
  return simpleBridgePlayCard({ hand, leadSuit })
}

// IA simple sans API (fallback)
function simpleBridgeBid(context) {
  const { hand, bids, lastBid } = context
  
  // Calculer les points
  let points = 0
  const suitCounts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 }
  
  hand.forEach(card => {
    if (card.rank === 'A') points += 4
    else if (card.rank === 'K') points += 3
    else if (card.rank === 'Q') points += 2
    else if (card.rank === 'J') points += 1
    suitCounts[card.suit]++
  })
  
  // Trouver la plus longue couleur
  let longestSuit = '♣'
  let maxCount = 0
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count > maxCount) {
      maxCount = count
      longestSuit = suit
    }
  }
  
  // Logique simple
  if (points < 6) return 'Passe'
  
  if (!lastBid) {
    // Ouvrir
    if (points >= 12 && points <= 14 && maxCount <= 4) return '1SA'
    if (points >= 12) return `1${longestSuit}`
    if (points >= 6 && maxCount >= 5) return `1${longestSuit}`
    return 'Passe'
  }
  
  // Répondre
  if (points < 6) return 'Passe'
  return 'Passe'
}

function simpleBridgePlayCard(context) {
  const { hand, leadSuit } = context
  
  if (!hand || hand.length === 0) return null
  
  // Si on doit fournir à la couleur
  if (leadSuit) {
    const cardsInSuit = hand.filter(c => c.suit === leadSuit)
    if (cardsInSuit.length > 0) {
      // Jouer la plus petite de la couleur
      return cardsInSuit[cardsInSuit.length - 1]
    }
  }
  
  // Sinon, jouer la plus petite carte
  return hand[hand.length - 1]
}

export default {
  executePrompt,
  isConfigured,
  parseCSV,
  bridgeAIBid,
  bridgeAIPlayCard
}



