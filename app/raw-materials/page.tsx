import RawMaterialsClient from './RawMaterialsClient'

export default function RawMaterialsPage() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Raw Materials</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track inventory levels and reorder points.</p>
      </div>
      <RawMaterialsClient />
    </div>
  )
}
