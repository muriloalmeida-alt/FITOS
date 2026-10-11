/// Música em um toque (PRD v2.1): só Spotify e Apple Music, por destinos
/// oficiais fixos. O FitOS só encaminha para o serviço; não toca, não
/// controla e não sabe o que está tocando.

export const MUSIC_PROVIDERS = ["spotify", "apple_music"] as const;
export type MusicProvider = (typeof MUSIC_PROVIDERS)[number];

export const MUSIC_SERVICES: Record<MusicProvider, { name: string; url: string }> = {
  spotify: { name: "Spotify", url: "https://open.spotify.com/" },
  apple_music: { name: "Apple Music", url: "https://music.apple.com/" },
};

export function isMusicProvider(value: unknown): value is MusicProvider {
  return typeof value === "string" && (MUSIC_PROVIDERS as readonly string[]).includes(value);
}
