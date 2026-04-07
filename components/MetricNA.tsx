"use client"

interface Props {
  title: string
  description: string
  sector: string
  reason: string
  alternative: string
}

export default function MetricNA({ title, description, sector, reason, alternative }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 flex flex-col">
      {/* Header row — mirrors MetricChart */}
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
          {title}
        </p>
        <div className="relative group flex-shrink-0">
          <span className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-help text-xs leading-none">
            ⓘ
          </span>
          <div className="absolute z-20 hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-xl shadow-xl pointer-events-none">
            <p className="font-semibold mb-1 text-gray-200">{title}</p>
            <p className="text-gray-300 leading-relaxed">{description}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
          </div>
        </div>
      </div>

      {/* N/A value */}
      <p className="text-xl font-bold text-gray-300 dark:text-gray-600 mb-0.5">N/A</p>

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center mt-2 border-t border-dashed border-gray-100 dark:border-gray-700 pt-3">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-1">
          Not applicable · {sector}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{reason}</p>
        {alternative && (
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1.5 leading-relaxed italic">
            {alternative}
          </p>
        )}
      </div>
    </div>
  )
}
