const BASE_URL = 'https://scriptblox.com/api/script';

export interface ScriptGame {
  _id: string;
  name: string;
  imageUrl: string;
}

export interface Script {
  _id: string;
  title: string;
  game: ScriptGame;
  slug: string;
  verified: boolean;
  key: boolean;
  views: number;
  scriptType: string;
  isUniversal: boolean;
  isPatched: boolean;
  createdAt: string;
  updatedAt?: string;
  image?: string;
  script: string;
  matched?: string[];
}

export interface FetchScriptsResponse {
  result: {
    totalPages: number;
    nextPage?: number;
    max: number;
    scripts: Script[];
  };
}

export interface SearchScriptsResponse {
  result: {
    totalPages: number;
    scripts: Script[];
  };
}

export interface ScriptDetailsResponse {
  script: Script & {
    features?: string;
    tags?: string[];
    owner?: {
      _id: string;
      username: string;
      verified: boolean;
      profilePicture?: string;
      status?: string;
    };
    keyLink?: string;
    visibility?: string;
    likeCount?: number;
    dislikeCount?: number;
  };
}

export type SortBy = 'views' | 'likeCount' | 'createdAt' | 'updatedAt' | 'dislikeCount' | 'accuracy';
export type SortOrder = 'asc' | 'desc';
export type ScriptMode = 'free' | 'paid';

export interface FetchParams {
  page?: number;
  max?: number;
  mode?: ScriptMode;
  patched?: 0 | 1;
  key?: 0 | 1;
  universal?: 0 | 1;
  verified?: 0 | 1;
  sortBy?: SortBy;
  order?: SortOrder;
  owner?: string;
  placeId?: number;
}

export interface SearchParams extends FetchParams {
  q: string;
  strict?: boolean;
}

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

export async function fetchScripts(params: FetchParams = {}): Promise<FetchScriptsResponse> {
  const query = buildQueryString(params);
  const url = `${BASE_URL}/fetch${query ? `?${query}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch scripts: ${response.statusText}`);
  return response.json();
}

export async function searchScripts(params: SearchParams): Promise<SearchScriptsResponse> {
  const query = buildQueryString(params as Record<string, any>);
  const url = `${BASE_URL}/search?${query}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to search scripts: ${response.statusText}`);
  return response.json();
}

export async function getScriptDetails(slug: string): Promise<ScriptDetailsResponse> {
  const url = `${BASE_URL}/${slug}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to get script details: ${response.statusText}`);
  return response.json();
}

export async function getScriptRaw(slug: string): Promise<string> {
  const url = `${BASE_URL}/raw/${slug}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to get raw script: ${response.statusText}`);
  return response.text();
}
