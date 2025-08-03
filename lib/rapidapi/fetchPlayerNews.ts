export interface PlayerNews {
  title: string;
  link: string;
  source: string;
  summary: string;
  publishedDate: string;
}

export async function getPlayerNewsByName(
  name: string,
  apiKey: string | undefined,
  apiHost: string | undefined
): Promise<PlayerNews[] | null> {
  if (!apiKey || !apiHost) {
    console.error(
      '[RapidAPI] Credentials were not provided to getPlayerNewsByName function.'
    );
    return null;
  }

  const params = new URLSearchParams({
    playerName: name,
  });

  const url = `https://${apiHost}/getNFLPlayerNews?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('RapidAPI Error:', errorData);
      return null;
    }

    const data = await response.json();

    if (data.body && Array.isArray(data.body) && data.body.length > 0) {
      return data.body.map((newsItem: any) => ({
        title: newsItem.title,
        link: newsItem.link,
        source: newsItem.source,
        summary: newsItem.summary,
        publishedDate: newsItem.published_date,
      }));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching player news for ${name}:`, error);
    return null;
  }
}
