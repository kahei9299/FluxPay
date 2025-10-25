import Image from 'next/image'

export function BrandLogo({
  variant = 'mark',
  size = 32,
  className = '',
}: {
  variant?: 'mark' | 'wordmark'
  size?: number
  className?: string
}) {
  const src = variant === 'wordmark' ? '/fluxpay-logo-wordmark.svg' : '/fluxpay-logo-mark.svg'
  const alt = variant === 'wordmark' ? 'FluxPay wordmark' : 'FluxPay logo'
  const width = variant === 'wordmark' ? size * 5 : size
  const height = size
  return <Image src={src} alt={alt} width={width} height={height} className={className} priority />
}


