'use client';

export type CityCommunity = {
  city: 'Москва' | 'Санкт-Петербург';
  chatUrl?: string | null;
  folderUrl?: string | null;
};

function safeTelegramUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 't.me' || url.hostname === 'telegram.me') ? url.toString() : null;
  } catch {
    return null;
  }
}

export function CityCommunities({
  communities,
  onOpen,
}: {
  communities: CityCommunity[];
  onOpen: (url: string) => void;
}) {
  const configured = communities.flatMap((community) => {
    const chatUrl = safeTelegramUrl(community.chatUrl);
    const folderUrl = safeTelegramUrl(community.folderUrl);
    return chatUrl || folderUrl ? [{ ...community, chatUrl, folderUrl }] : [];
  });
  if (communities.length === 0 || configured.length === 0) return null;

  return (
    <section className="city-communities" aria-labelledby="city-communities-title">
      <div className="social-section-heading">
        <div>
          <h3 id="city-communities-title">Городские сообщества</h3>
          <p>Официальные чаты Псё с правилами и модерацией.</p>
        </div>
      </div>
      <div className="city-community-list">
        {configured.map((community) => (
          <article key={community.city}>
            <b>{community.city}</b>
            <div>
              {community.chatUrl && <button type="button" onClick={() => onOpen(community.chatUrl!)}>Открыть чат</button>}
              {community.folderUrl && <button type="button" onClick={() => onOpen(community.folderUrl!)}>Открыть папку</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

