import { Suspense } from 'react'
import ProductJourneyDetailClient from './ProductJourneyDetailClient'

export const dynamic = 'force-dynamic'

export default function ProductJourneyDetailPage() {
  return (
    <Suspense>
      <ProductJourneyDetailClient />
    </Suspense>
  )
}
