const DB_NAME = "autohub-fotos"
const DB_VERSION = 1
const STORE = "fotos"

export interface FotoEntry {
  id: number
  veiculo_id: string
  nome: string
  tipo: string
  tamanho: number
  blob: Blob
  criado_em: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true })
        s.createIndex("veiculo_id", "veiculo_id", { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addFoto(veiculoId: string, file: File): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const req = tx.objectStore(STORE).add({
      veiculo_id: veiculoId,
      nome: file.name,
      tipo: file.type,
      tamanho: file.size,
      blob: file,
      criado_em: new Date().toISOString(),
    })
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function getFotos(veiculoId: string): Promise<FotoEntry[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).index("veiculo_id").getAll(veiculoId)
    req.onsuccess = () => resolve(req.result as FotoEntry[])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteFoto(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const req = tx.objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
