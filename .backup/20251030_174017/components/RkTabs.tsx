'use client'

type Props = { active: 'rk' | 'groups' | 'archive' }

export default function RkTabs({ active }: Props) {
  const Tab = ({
    id,
    label,
    href,
  }: { id: Props['active']; label: string; href: string }) => {
    const isActive = active === id
    return (
      <a
        href={href}
        className={[
          'ad-pill',
          isActive ? 'ad-pill--active' : 'ad-pill--ghost',
        ].join(' ')}
      >
        {label}
      </a>
    )
  }

  return (
    <div className="flex items-center gap-8">
      <div className="text-sm font-medium text-[color:var(--ad-dark)]">Разделы</div>
      <div className="flex gap-8">
        <Tab id="rk" label="РК" href="/campaigns" />
        <Tab id="groups" label="Группы" href="/campaigns/groups" />
        <Tab id="archive" label="Архив" href="/campaigns/deleted" />
      </div>
    </div>
  )
}
