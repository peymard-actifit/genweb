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

export default {
  executePrompt,
  isConfigured,
  parseCSV
}



