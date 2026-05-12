import ProductsClient from './ProductsClient'

export default function ProductsPage() {
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your product catalog.</p>
      </div>
      <ProductsClient />
    </div>
  )
}
