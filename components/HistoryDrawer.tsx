"use client"

import { useEffect, useRef } from "react"

export interface HistoryEntry {
  id: string
  ticker: string
  companyName: string
  date: string
  financials: any
  analysis: any
}

const STORAGE_KEY = "stock-snapshot-history"
const MAX_ENTRIES = 30

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveToHistory(entry: HistoryEntry) {
  const existing = loadHistory().filter((e) => e.ticker !== entry.ticker)
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function deleteFromHistory(id: string) {
  const updated = loadHistory().filter((e) => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

interface Props {
  open: boolean
  onClose: () => void
  history: HistoryEntry[]
  onLoad: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

export default function HistoryDrawer({
  open, onClose, history, onLoad, onDelete, onClearAll,
}: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, onClose])

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">History</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {history.length} {history.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No history yet.</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Lookups will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-700">
              {history.map((entry) => (
                <li key={entry.id} className="relative group hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <button
                    className="w-full text-left px-5 py-4 pr-12"
                    onClick={() => { onLoad(entry); onClose() }}
                  >
                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">
                      {entry.companyName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {entry.ticker} · {entry.date}
                    </p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 bg-gray-100 hover:bg-red-100 dark:bg-gray-700 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-500 flex items-center justify-center transition-all"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Click any entry to reload without re-fetching. Last {MAX_ENTRIES} lookups kept.
          </p>
        </div>
      </div>
    </>
  )
}
