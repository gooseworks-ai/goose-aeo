interface ProviderLogoProps {
  provider: string
  size?: number
}

function OpenAILogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="#0c0a09"/>
    </svg>
  )
}

function PerplexityLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1L4 5.5v5L1 12l3 1.5v5L12 23l8-4.5v-5L23 12l-3-1.5v-5L12 1zm0 2.2l5.6 3.15v3.3L12 12.8 6.4 9.65v-3.3L12 3.2zm-6.4 7.6L12 14.15l6.4-3.35 1.6.9-8 4.5-8-4.5 1.6-.9zm6.4 10l-5.6-3.15v-3.3L12 17.5l5.6-3.15v3.3L12 20.8z" fill="#0c0a09"/>
    </svg>
  )
}

function GoogleLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GrokLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 3l8 10L3 21h2l7-7 7 7h2l-8-10L19 3h-2l-6 6.5L5 3H3z" fill="#0c0a09"/>
    </svg>
  )
}

function ClaudeLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M16.98 6.02L13.26 17.1h-2.51l3.72-11.08h2.51zm-7.47 0L5.79 17.1H3.28L7 6.02h2.51zM20.72 17.1h-2.51L14.49 6.02h2.51l3.72 11.08z" fill="#D97706"/>
    </svg>
  )
}

function DeepSeekLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#0c0a09" strokeWidth="1.5" fill="none" />
      <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#0c0a09"/>
    </svg>
  )
}

function DefaultLogo({ size, provider }: { size: number; provider: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-md bg-stone-100 text-[10px] font-bold text-stone-500 uppercase"
      style={{ width: size, height: size }}
    >
      {provider.slice(0, 2)}
    </div>
  )
}

import type { ReactElement } from 'react'

const logoMap: Record<string, (props: { size: number }) => ReactElement> = {
  openai: OpenAILogo,
  perplexity: PerplexityLogo,
  gemini: GoogleLogo,
  google: GoogleLogo,
  grok: GrokLogo,
  claude: ClaudeLogo,
  deepseek: DeepSeekLogo,
}

export function ProviderLogo({ provider, size = 18 }: ProviderLogoProps) {
  const normalized = provider.toLowerCase()
  const Logo = logoMap[normalized]
  if (Logo) {
    return <Logo size={size} />
  }
  return <DefaultLogo size={size} provider={provider} />
}
